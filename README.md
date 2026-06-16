# DynaDemoCap · Exchange Simulado

Aplicación web que simula un *exchange* de consulta de tipos de cambio, construida bajo
la metodología **Harness-SDD** (Spec-Driven Development). Las especificaciones que la
gobiernan están en [`specs/`](specs/).

## Arquitectura

| Componente | Stack | Puerto | Rol |
|-----------|-------|--------|-----|
| **FE** — Mockup | Vue 3 + Vite | `5173` | UI tipo exchange: consulta tasas y guarda transacciones simuladas |
| **SIM** — Simulador / Caché | Node.js | `4001` | Consume `exchangerate` **una sola vez** (seed → snapshot JSON) y sirve desde caché |
| **PER** — Persistencia | Node.js | `4002` | Guarda transacciones simuladas en almacén local JSONL |
| **LOG** | módulo compartido | — | Logs estructurados (JSON una línea) con `correlationId` en SIM y PER |

**Monedas soportadas:** USD, JPY, MXN, PEN, COP, EUR.

## Estrategia de caché

La API externa se consulta **una única vez** (paso de *seed*) y el resultado se persiste
en `services/simulator/data/rates.snapshot.json` (fuente de verdad, versionada). En cada
arranque el SIM carga ese snapshot a memoria **sin tocar la red**, preservando la cuota.
Si no hay clave válida o el fetch falla, el seed usa un fallback embebido para que la demo
sea ejecutable de inmediato (`source: "fallback"`).

## Requisitos

- Node.js ≥ 18 (incluye `fetch` nativo)
- npm

## ¿Qué ejecuto y dónde?

No son pasos en secuencia: eliges **uno según el contexto**.

| Quiero… | Ejecuta | Dónde |
|---------|---------|-------|
| Desarrollar/probar **en mi máquina** | `scripts/start-local.sh` (Linux/macOS) · `scripts/start-local.ps1` (Windows) | tu **PC** |
| Desplegar/actualizar **en el servidor** | `scripts/deploy-server.sh` | la **VM** (hace `git pull` + levanta todo) |

> En la VM **no** se usa `start-local`: `deploy-server.sh` ya arranca SIM/PER/FE y Fluent Bit.

## Cómo ejecutar (dev local)

1. Copia la configuración: `cp .env.example .env` (ya incluido con placeholders válidos).
2. Levanta todo con el script de tu plataforma:

```bash
# Linux / macOS
chmod +x scripts/start-local.sh
./scripts/start-local.sh
```

```powershell
# Windows
.\scripts\start-local.ps1
```

3. Abre **http://localhost:5173**.

Los scripts validan, **antes** de levantar nada: variables de entorno obligatorias,
dependencias (Node/npm, `node_modules` del frontend) y puertos libres. Luego ejecutan el
seed y arrancan SIM → PER → FE en orden.

## Despliegue en el servidor (GitOps)

```bash
# En tu PC, tras editar:
git add -A && git commit -m "..." && git push

# En la VM (un solo comando: trae el repo y levanta todo):
bash ~/DynaDemoCap/scripts/deploy-server.sh
```

### Tasas en vivo (opcional)

Edita `.env` y coloca una `EXCHANGERATE_API_KEY` y `EXCHANGERATE_BASE_URL` reales, borra
`services/simulator/data/rates.snapshot.json` y vuelve a arrancar: el seed regenerará el
snapshot con datos en vivo.

## Endpoints

| Servicio | Método | Ruta | Descripción |
|----------|--------|------|-------------|
| SIM | GET | `/health` | Estado de caché, `lastFetchAt`, `currencyCount` |
| SIM | GET | `/rate?base=USD&target=PEN&amount=100` | Conversión derivada del snapshot |
| PER | POST | `/transactions` | Guarda una transacción simulada |
| PER | GET | `/transactions` | Histórico persistido |

## Estructura

```
DynaDemoCap/
├── scripts/         start-local.sh/.ps1 (dev) · deploy-server.sh (VM)
├── shared/logger/   logger estructurado compartido
├── services/
│   ├── simulator/   seed.js · server.js · data/rates.snapshot.json
│   └── persistence/ server.js · data/transactions.jsonl (runtime)
├── frontend/        app Vue (Vite)
├── specs/           requirements.md · design.md · tasks.md (Harness-SDD)
└── docs/            documentación del arnés
```
