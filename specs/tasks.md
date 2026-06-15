# Tasks — `f1_exchange_simulator`

> **Metodología:** Harness-SDD (Spec-Driven Development)
> **Estado:** `implemented` — aprobación `spec_ready` recibida; código implementado y verificado.
> **Convención:** `[ ]` pendiente · `[~]` en progreso · `[x]` completado. Cada tarea referencia requisitos (R-*).

---

## T0 — Andamiaje del proyecto
- [x] **T0.1** Crear estructura de carpetas: `frontend/` (Vue), `services/simulator/` (SIM), `services/persistence/` (PER), `scripts/`, `shared/logger/`.
- [x] **T0.2** Crear `.env.example` con `EXCHANGERATE_API_KEY`, `EXCHANGERATE_BASE_URL`, `SIM_PORT`, `PERSIST_PORT`, `FRONTEND_PORT`. *(R-ENV-01, R-NFR-03)*
- [x] **T0.3** Inicializar `package.json` de cada servicio Node y del frontend Vue. *(R-ENV-05)*

## T1 — Scripts de entorno con validaciones *(R-ENV-01..07)*
- [x] **T1.1** `scripts/start.sh` (Bash): validar variables de entorno obligatorias; abortar con mensaje si falta alguna. *(R-ENV-01, R-ENV-02)*
- [x] **T1.2** `scripts/start.sh`: validar dependencias (Node disponible, `node_modules` presentes). *(R-ENV-05)*
- [x] **T1.3** `scripts/start.sh`: validar puertos libres (`SIM_PORT`, `PERSIST_PORT`, `FRONTEND_PORT`); abortar y reportar conflicto. *(R-ENV-03, R-ENV-04)*
- [x] **T1.4** `scripts/start.sh`: arrancar SIM → PER → FE en orden, con log de inicio por servicio. *(R-ENV-06)*
- [x] **T1.5** `scripts/start.ps1` (PowerShell): paridad exacta de T1.1–T1.4 (mismas validaciones, códigos de salida y mensajes). *(R-ENV-07)*

## T2 — Subsistema de Logs compartido *(R-LOG-01..05)*
- [x] **T2.1** Crear `shared/logger/` reutilizable: logger JSON una línea con esquema `{timestamp, level, service, event, correlationId, message, data}`. *(R-LOG-01)*
- [x] **T2.2** Middleware/helper de `request.received` + `request.completed` con `statusCode` y `latencyMs`. *(R-LOG-02)*
- [x] **T2.3** Helper de logging de errores nivel `error` con `correlationId`. *(R-LOG-03)*
- [x] **T2.4** Propagación de `x-correlation-id` (generación si falta) reutilizable por SIM y PER. *(R-LOG-05)*

## T3 — Backend Simulador / Caché (SIM) *(R-SIM-00..06)*
- [x] **T3.1** Servidor HTTP Node en `SIM_PORT`.
- [x] **T3.2** Script de **seed** (`npm run seed:rates`): **una única** llamada a `exchangerate` limitada a {USD, JPY, MXN, PEN, COP, EUR}; materializar `services/simulator/data/rates.snapshot.json` (`base`, `rates`, `fetchedAt`); log `cache.bootstrap`. Si el snapshot ya existe, NO llamar a la API. *(R-SIM-00, R-SIM-01, R-SIM-01b, R-LOG-04, R-NFR-02)*
- [x] **T3.2b** Bootstrap de arranque: cargar `rates.snapshot.json` a caché en memoria, sin llamadas de red. *(R-SIM-01c, R-SIM-02)*
- [x] **T3.3** `GET /rate?base&target&amount`: validar que el par esté en las 6 monedas; derivar tasa desde caché (`rate(target)/rate(base)`) y devolver conversión. *(R-SIM-00, R-SIM-02, R-SIM-03)*
- [x] **T3.4** Manejo de par inexistente ⇒ 404 `CURRENCY_NOT_FOUND`. *(R-SIM-04)*
- [x] **T3.5** Manejo de fallo de fetch ⇒ estado `degraded`, sin reintento infinito. *(R-SIM-05)*
- [x] **T3.6** `GET /health`: `status`, `lastFetchAt`, `currencyCount`. *(R-SIM-06)*

## T4 — Servicio de Persistencia (PER) *(R-PER-01..04)*
- [x] **T4.1** Servidor HTTP Node en `PERSIST_PORT`.
- [x] **T4.2** `POST /transactions`: validar payload; persistir en almacén local (JSONL/JSON); devolver `id`. *(R-PER-01, R-PER-02)*
- [x] **T4.3** Validación: payload inválido ⇒ 400 con detalle, sin persistencia parcial. *(R-PER-03)*
- [x] **T4.4** `GET /transactions`: devolver histórico persistido. *(R-PER-04)*

## T5 — Mockup Frontend (Vue) *(R-FE-01..02)*
- [x] **T5.1** Scaffolding de app Vue servida en `FRONTEND_PORT`.
- [x] **T5.2** UI tipo exchange: selector origen/destino limitado a {USD, JPY, MXN, PEN, COP, EUR} + input de monto + resultado de conversión. *(R-SIM-00, R-FE-01)*
- [x] **T5.3** Integración con SIM (`GET /rate`) y manejo de error no técnico manteniendo UI usable. *(R-FE-02)*
- [x] **T5.4** Acción "guardar transacción" → `POST /transactions` (PER); listado de histórico (`GET /transactions`). *(R-PER-01, R-PER-04)*
- [x] **T5.5** Generar y enviar `x-correlation-id` en las peticiones. *(R-LOG-05)*

## T6 — Verificación de extremo a extremo
- [x] **T6.1** Verificar que el SIM hace **exactamente una** llamada a `exchangerate` (contador/log de bootstrap). *(R-NFR-02)*
- [x] **T6.2** Verificar arranque limpio vía `start.sh` y `start.ps1` (variables, puertos, dependencias). *(R-ENV-*)*
- [x] **T6.3** Verificar flujo completo: consulta → conversión → guardado → histórico.
- [x] **T6.4** Verificar presencia de logs estructurados con `correlationId` en SIM y PER. *(R-LOG-*)*
- [x] **T6.5** Documentar uso en `docs/` y actualizar `feature_list.json` a `status: done`.
