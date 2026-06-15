# Design — `f1_exchange_simulator`

> **Metodología:** Harness-SDD (Spec-Driven Development)
> **Estado:** `spec_pending_approval`
> **Trazabilidad:** cada decisión referencia los requisitos de `requirements.md` (R-*).

---

## 1. Arquitectura General

```
┌──────────────────────────────────────────────────────────────┐
│                      Operador / Usuario                        │
└───────────────┬───────────────────────────────┬──────────────┘
                │ ejecuta                         │ navega
        ┌───────▼────────┐                ┌───────▼─────────┐
        │ start.sh /      │                │  Mockup Vue (FE)│
        │ start.ps1 (ENV) │                │  :FRONTEND_PORT │
        │ validación+boot │                └───┬────────┬────┘
        └───────┬────────┘            consulta │        │ guarda
                │ levanta                       │ tasa   │ transacción
     ┌──────────┼────────────┐          ┌───────▼──┐  ┌──▼────────────┐
     ▼          ▼            ▼          │  SIM     │  │  PER          │
  (SIM)       (PER)        (FE)         │ Node.js  │  │  Node.js      │
                                        │ :SIM_PORT│  │ :PERSIST_PORT │
                                        └────┬─────┘  └──────┬────────┘
                                  1 sola vez │                │
                                        ┌────▼─────┐    ┌─────▼──────┐
                                        │exchange  │    │ store local│
                                        │rate API  │    │ JSONL/JSON │
                                        └──────────┘    └────────────┘
        ▲ logs estructurados (JSON) emitidos por SIM, PER y ENV ▲
```

**Separación de responsabilidades (R-SIM, R-PER, R-FE):**
- **FE (Vue):** solo presentación e interacción. No conoce a `exchangerate`; habla únicamente con SIM (tasas) y PER (guardado).
- **SIM (Node):** único punto que toca la API externa. Mantiene la caché en memoria. No persiste.
- **PER (Node):** único responsable de la durabilidad. No conoce tasas ni API externa.
- **ENV (.sh/.ps1):** orquesta validación y arranque. No contiene lógica de negocio.

---

## 2. Diseño de Infraestructura Local (R-ENV-01..07)

Los scripts `start.sh` (Bash) y `start.ps1` (PowerShell) comparten **el mismo contrato de validación**:

| Fase | Validación | Acción si falla |
|------|-----------|-----------------|
| 1. Variables | Verifica que existan y no estén vacías: `EXCHANGERATE_API_KEY`, `EXCHANGERATE_BASE_URL`, `SIM_PORT`, `PERSIST_PORT`, `FRONTEND_PORT` | `exit 1` + mensaje "Falta variable X" (R-ENV-02) |
| 2. Dependencias | `node --version` disponible; `node_modules/` presente en cada servicio | Instruir `npm install` / `exit 1` (R-ENV-05) |
| 3. Puertos | Cada puerto debe estar libre | `exit 1` + reporte de puerto en conflicto (R-ENV-04) |
| 4. Arranque | Levantar SIM → PER → FE en orden | Log de inicio por servicio (R-ENV-06) |

**Lógica de chequeo de puertos:**
- **Bash:** preferir `ss -ltn` / `lsof -i :PORT` (fallback a intento de bind con `nc`/Node).
- **PowerShell:** `Get-NetTCPConnection -LocalPort $port` o `Test-NetConnection`; ausencia de conexión LISTEN ⇒ puerto libre.

**Carga de variables:** ambos scripts leen un archivo `.env` (no versionado) basado en `.env.example`. Paridad garantizada por contrato común (R-ENV-07): mismos nombres de variable, mismos códigos de salida, mismos textos de error.

---

## 3. Arquitectura de Servicios

### 3.1 SIM — Simulador / Caché (R-SIM-01..06)
- **Runtime:** Node.js (HTTP server; framework ligero tipo Express o `http` nativo — decisión de implementación).
- **Endpoints previstos:**
  - `GET /health` → estado de caché (`ready|degraded`), `lastFetchAt`, `currencyCount` (R-SIM-06).
  - `GET /rate?base=USD&target=EUR&amount=100` → `{ base, target, rate, amount, convertedAmount, fetchedAt }` (R-SIM-03).
- **Seed (una vez):** una única petición a `EXCHANGERATE_BASE_URL` con `EXCHANGERATE_API_KEY`, limitada a las 6 monedas, que materializa `data/rates.snapshot.json` (R-SIM-01, R-SIM-01b, R-NFR-02).
- **Bootstrap (cada arranque):** carga `data/rates.snapshot.json` a memoria, sin llamadas de red (R-SIM-01c).
- **Errores:** par inexistente ⇒ 404 `CURRENCY_NOT_FOUND` (R-SIM-04); fallo de fetch ⇒ estado `degraded`, sin reintento infinito (R-SIM-05).

### 3.2 PER — Persistencia (R-PER-01..04)
- **Runtime:** Node.js (HTTP server independiente).
- **Endpoints previstos:**
  - `POST /transactions` → valida y persiste `{ base, target, amount, rate, convertedAmount, timestamp }`, devuelve `{ id }` (R-PER-01, R-PER-02).
  - `GET /transactions` → histórico persistido (R-PER-04).
- **Validación:** payload incompleto ⇒ 400 con detalle, sin persistencia parcial (R-PER-03).

### 3.3 FE — Mockup Vue (R-FE-01..02)
- **Runtime:** Vue.js (SPA servida en `FRONTEND_PORT`).
- **Vistas:** selector de moneda origen/destino, input de monto, resultado de conversión, botón "guardar transacción", panel/listado de histórico.
- **Resiliencia:** error de SIM/PER ⇒ mensaje no técnico, UI sigue usable (R-FE-02).

---

## 4. Estrategia de Caché y Snapshot (R-SIM-00..02, R-NFR-02)

- **Monedas (alcance fijo):** `USD, JPY, MXN, PEN, COP, EUR` (normalización: `JPN→JPY`, `COL→COP`).
- **Snapshot persistido en código (fuente de verdad):** la llamada a `exchangerate` se ejecuta **una sola vez como paso de "seed"** y su resultado se escribe en un archivo JSON versionado en el repositorio, p. ej.:
  ```
  services/simulator/data/rates.snapshot.json
  {
    "base": "USD",
    "fetchedAt": "2026-06-14T00:00:00.000Z",
    "source": "exchangerate",
    "rates": { "USD": 1, "EUR": 0.92, "JPY": 156.3, "MXN": 18.7, "PEN": 3.75, "COP": 4050.0 }
  }
  ```
  - Un script de seed (`npm run seed:rates` o paso del SIM con flag) realiza el fetch único y materializa este archivo. Si el archivo ya existe, **no** se vuelve a llamar a la API (R-SIM-01c, R-NFR-02).
- **Caché en memoria:** en cada arranque, el SIM **carga el snapshot JSON** a una estructura en memoria (objeto/`Map`). No hay llamada de red en el arranque normal.
- **Cálculo de pares:** la tasa `base→target` se deriva del snapshot mediante `rate(target)/rate(base)`, sin llamadas adicionales.
- **Política de invalidación:** ninguna en runtime. Para refrescar tasas se re-ejecuta el paso de seed (que regenera el JSON), no en cada arranque.
- **Fallo:** si el snapshot no existe y el seed falla, el servicio marca `degraded` y las consultas responden error controlado (R-SIM-05).

---

## 5. Estrategia de Observabilidad / Logs (R-LOG-01..05)

- **Formato:** JSON estructurado, **una línea por evento** (`stdout`), apto para captura por el orquestador.
- **Esquema mínimo común:**
  ```json
  { "timestamp": "ISO-8601", "level": "info|warn|error", "service": "sim|per|env",
    "event": "request.received", "correlationId": "uuid", "message": "...", "data": {} }
  ```
- **Eventos clave:**
  - `request.received` / `request.completed` (con `statusCode` y `latencyMs`) — R-LOG-02.
  - `cache.bootstrap` (resultado + `currencyCount`) — R-LOG-04.
  - `error` (detalle + `correlationId`) — R-LOG-03.
- **Correlación:** el FE genera/propaga un header `x-correlation-id`; SIM y PER lo reutilizan o generan uno si falta, y lo incluyen en cada log (R-LOG-05).
- **Logger:** módulo logger compartido y reutilizable entre SIM y PER (mismo esquema, distinto `service`).

---

## 6. Configuración (variables de entorno)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `EXCHANGERATE_API_KEY` | Clave de la API externa | `xxxxx` |
| `EXCHANGERATE_BASE_URL` | Endpoint base de exchangerate | `https://api.exchangerate.host/...` |
| `SIM_PORT` | Puerto del Simulador/Caché | `4001` |
| `PERSIST_PORT` | Puerto del servicio de Persistencia | `4002` |
| `FRONTEND_PORT` | Puerto del Mockup Vue | `5173` |

Se entregará un `.env.example`; `.env` real queda fuera de control de versiones.

---

## 7. Decisiones y Trade-offs

| Decisión | Alternativa descartada | Razón |
|----------|------------------------|-------|
| Snapshot JSON versionado + caché en memoria | Caché solo en memoria / Redis | El fetch único se materializa en código (fuente de verdad reproducible); preserva cuota (R-SIM-01b, R-NFR-02) |
| Alcance fijo de 6 monedas (USD, JPY, MXN, PEN, COP, EUR) | Catálogo completo de exchangerate | Demo acotada y determinista (R-SIM-00) |
| Persistencia en archivo JSONL | Base de datos relacional | Demo local sin dependencias (R-NFR-01) |
| SIM y PER como procesos separados | Monolito único | Separación de responsabilidades clara |
| Logs JSON una línea | Texto plano | Trazabilidad y parsing estructurado (R-LOG-01) |
| Scripts duales `.sh`/`.ps1` con contrato común | Un solo script multiplataforma | Requisito explícito de paridad (R-ENV-07) |
