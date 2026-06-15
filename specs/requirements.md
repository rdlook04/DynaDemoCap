# Requirements — `f1_exchange_simulator`

> **Metodología:** Harness-SDD (Spec-Driven Development)
> **Notación:** EARS (Event → Action → Result → System)
> **Estado:** `spec_pending_approval`

Cada requisito EARS se expresa con la plantilla:
**WHEN** `<Event>` **the system SHALL** `<Action/Result>` **so that** `<System goal>`.
Variantes usadas: *Ubiquitous* (siempre), *Event-driven* (WHEN), *State-driven* (WHILE), *Unwanted-behaviour* (IF...THEN).

---

## 1. Actores y Componentes

| Código | Componente | Stack | Responsabilidad |
|--------|-----------|-------|-----------------|
| **FE** | Mockup Frontend | Vue.js | UI tipo exchange; consulta tasas; envía transacciones simuladas |
| **SIM** | Simulador / Caché | Node.js | Fetch único a `exchangerate`; sirve tasas desde caché en memoria |
| **PER** | Servicio de Persistencia | Node.js | Guarda consultas/transacciones simuladas |
| **ENV** | Automatización de entorno | `.sh` / `.ps1` | Validación previa y arranque de servicios |
| **LOG** | Subsistema de Logs | (transversal) | Logs estructurados en todos los componentes |

---

## 2. Flujo de Arranque (ENV)

- **R-ENV-01 (Event-driven)** — WHEN el operador ejecuta `start.sh` (Linux/macOS) o `start.ps1` (Windows), the system SHALL validar la presencia de las variables de entorno requeridas (`EXCHANGERATE_API_KEY`, `EXCHANGERATE_BASE_URL`, `SIM_PORT`, `PERSIST_PORT`, `FRONTEND_PORT`) **antes** de iniciar cualquier proceso.
- **R-ENV-02 (Unwanted-behaviour)** — IF alguna variable de entorno obligatoria falta o está vacía, THEN the system SHALL abortar el arranque con código de salida distinto de cero y emitir un mensaje claro indicando la variable faltante.
- **R-ENV-03 (Event-driven)** — WHEN el script de arranque se ejecuta, the system SHALL comprobar que los puertos `SIM_PORT`, `PERSIST_PORT` y `FRONTEND_PORT` están libres antes de levantar los servicios.
- **R-ENV-04 (Unwanted-behaviour)** — IF un puerto requerido está ocupado, THEN the system SHALL abortar el arranque, reportar el puerto en conflicto y NO iniciar servicios parciales.
- **R-ENV-05 (Event-driven)** — WHEN se valida el entorno, the system SHALL verificar que las dependencias estén instaladas (Node.js disponible y `node_modules` presentes) y ofrecer/instruir su instalación si faltan.
- **R-ENV-06 (State-driven)** — WHILE todas las validaciones previas resultan exitosas, the system SHALL levantar en orden el servicio SIM, luego PER y por último el FE, registrando un log de inicio por cada uno.
- **R-ENV-07 (Ubiquitous)** — The system SHALL ofrecer paridad funcional entre `start.sh` y `start.ps1` (mismas validaciones, mismos códigos de salida, mismos mensajes).

---

## 3. Flujo de Consulta de Tasas (FE ↔ SIM)

> **Monedas soportadas (alcance fijo):** USD, JPY, MXN, PEN, COP, EUR.
> Normalización ISO 4217 aplicada a la entrada del proyecto: `JPN→JPY`, `COL→COP`.

- **R-SIM-00 (Ubiquitous)** — The system SHALL limitar el dominio de monedas a **{USD, JPY, MXN, PEN, COP, EUR}**.
- **R-SIM-01 (Event-driven)** — WHEN se realiza el bootstrap de tasas, the system SHALL ejecutar **una única** llamada HTTP a la API de `exchangerate` para obtener las tasas de las 6 monedas soportadas.
- **R-SIM-01b (Event-driven)** — WHEN la llamada inicial a `exchangerate` retorna correctamente, the system SHALL **persistir el payload como un snapshot JSON dentro del código del repositorio** (p. ej. `services/simulator/data/rates.snapshot.json`), incluyendo `base`, mapa `currency→rate` y `fetchedAt`, para que sea la fuente de verdad del servicio simulado.
- **R-SIM-01c (State-driven)** — WHILE el snapshot JSON exista en el repositorio, the system SHALL arrancar el SIM **desde el snapshot persistido sin volver a llamar** a la API externa (la llamada en vivo es un paso de "seed" puntual, no de cada arranque).
- **R-SIM-02 (State-driven)** — WHILE el snapshot esté cargado en la caché en memoria, the system SHALL responder todas las consultas del FE desde la caché, SIN realizar nuevas llamadas a la API externa.
- **R-SIM-03 (Event-driven)** — WHEN el FE solicita la tasa de un par de monedas (`base` → `target`), the system SHALL devolver la tasa calculada a partir del payload cacheado y el timestamp de obtención.
- **R-SIM-04 (Unwanted-behaviour)** — IF el FE solicita un par de monedas inexistente en el payload, THEN the system SHALL responder con un error HTTP 404 estructurado y un código de error legible (`CURRENCY_NOT_FOUND`).
- **R-SIM-05 (Unwanted-behaviour)** — IF la llamada inicial a `exchangerate` falla (red, cuota o error HTTP), THEN the system SHALL registrar el error, exponer el estado `degraded` en el endpoint de salud y NO reintentar de forma indefinida.
- **R-SIM-06 (Event-driven)** — WHEN el FE consulta el endpoint de salud del SIM, the system SHALL devolver el estado de la caché (`ready` | `degraded`), el timestamp del último fetch y el número de monedas disponibles.
- **R-FE-01 (Event-driven)** — WHEN el usuario selecciona moneda origen y destino e introduce un monto, the system SHALL solicitar la tasa al SIM y mostrar el monto convertido en la interfaz.
- **R-FE-02 (Unwanted-behaviour)** — IF el SIM no responde o devuelve error, THEN the system SHALL mostrar al usuario un mensaje de error no técnico y mantener la UI utilizable.

---

## 4. Flujo de Guardado / Transacciones (FE → PER)

- **R-PER-01 (Event-driven)** — WHEN el usuario confirma una consulta o transacción simulada en el FE, the system SHALL enviar al servicio PER un registro con `{ base, target, amount, rate, convertedAmount, timestamp }`.
- **R-PER-02 (Event-driven)** — WHEN el servicio PER recibe un registro válido, the system SHALL persistirlo de forma duradera (almacén local: archivo JSON/JSONL o equivalente) y devolver un identificador único de registro.
- **R-PER-03 (Unwanted-behaviour)** — IF el payload recibido por PER es inválido o incompleto, THEN the system SHALL rechazarlo con HTTP 400 y un detalle de validación, sin persistir datos parciales.
- **R-PER-04 (Event-driven)** — WHEN se solicita el histórico de registros, the system SHALL devolver la lista de transacciones simuladas persistidas.

---

## 5. Flujo de Logs / Observabilidad (LOG — transversal)

- **R-LOG-01 (Ubiquitous)** — The system SHALL emitir logs **estructurados** (JSON de una línea) en SIM y PER, conteniendo como mínimo: `timestamp`, `level`, `service`, `event`, `correlationId` y `message`.
- **R-LOG-02 (Event-driven)** — WHEN cualquier servicio recibe una petición HTTP, the system SHALL registrar un log de entrada (`request.received`) y uno de salida (`request.completed`) con el código de estado y la latencia.
- **R-LOG-03 (Event-driven)** — WHEN ocurre un error en cualquier componente, the system SHALL registrar un log de nivel `error` con el detalle y el `correlationId` asociado.
- **R-LOG-04 (Event-driven)** — WHEN el SIM realiza el fetch inicial a `exchangerate`, the system SHALL registrar el evento `cache.bootstrap` con el resultado (éxito/fallo) y la cantidad de monedas cargadas.
- **R-LOG-05 (Ubiquitous)** — The system SHALL propagar un `correlationId` desde el FE a través de SIM y PER para permitir trazabilidad de extremo a extremo.

---

## 6. Requisitos No Funcionales

- **R-NFR-01** — The system SHALL ejecutarse íntegramente en local sin dependencias de nube.
- **R-NFR-02** — La API externa `exchangerate` SHALL ser consumida **como máximo una vez** (paso de seed) para generar el snapshot JSON; los arranques posteriores SHALL servirse del snapshot persistido, para preservar la cuota.
- **R-NFR-03** — Los puertos SHALL ser configurables vía variables de entorno.
- **R-NFR-04** — The system SHALL degradar de forma controlada (sin crash) ante fallo de la API externa.

---

## 7. Criterios de Aceptación (resumen)

1. `start.sh` y `start.ps1` validan variables, puertos y dependencias antes de levantar nada.
2. SIM hace exactamente **una** llamada a `exchangerate` y luego sirve siempre desde caché.
3. FE consulta y muestra conversiones; PER persiste transacciones simuladas y devuelve histórico.
4. Todos los servicios emiten logs estructurados con `correlationId`.
