#!/usr/bin/env bash
# ============================================================================
# DynaDemoCap · Arranque del entorno (Linux/macOS)  — R-ENV-01..07
# Valida variables, dependencias y puertos antes de levantar SIM, PER y FE.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log()  { echo "[start-local] $1"; }
fail() { echo "[start-local][ERROR] $1" >&2; exit 1; }

# --- Cargar .env -----------------------------------------------------------
if [ -f .env ]; then
  set -a; . ./.env; set +a
else
  fail "No existe .env (copia .env.example a .env)"
fi

# --- 1. Validar variables de entorno obligatorias (R-ENV-01, R-ENV-02) -----
log "Validando variables de entorno..."
REQUIRED=(EXCHANGERATE_API_KEY EXCHANGERATE_BASE_URL SIM_PORT PERSIST_PORT FRONTEND_PORT)
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then fail "Falta variable de entorno: $v"; fi
done

# --- 2. Validar dependencias (R-ENV-05) ------------------------------------
log "Validando dependencias..."
command -v node >/dev/null 2>&1 || fail "Node.js no está instalado"
command -v npm  >/dev/null 2>&1 || fail "npm no está instalado"

if [ ! -d frontend/node_modules ]; then
  log "Instalando dependencias del frontend (npm install)..."
  ( cd frontend && npm install ) || fail "npm install falló en frontend"
fi

# --- 3. Validar puertos libres (R-ENV-03, R-ENV-04) ------------------------
check_port_free() {
  node -e "const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(1));s.listen(${1},()=>s.close(()=>process.exit(0)));"
}
log "Validando puertos..."
for pair in "SIM_PORT:${SIM_PORT}" "PERSIST_PORT:${PERSIST_PORT}" "FRONTEND_PORT:${FRONTEND_PORT}"; do
  name="${pair%%:*}"; port="${pair##*:}"
  if ! check_port_free "$port"; then fail "Puerto ocupado ($name=$port)"; fi
done

# --- 4. Seed de tasas: UNA sola llamada -> snapshot JSON (R-SIM-01) ---------
log "Generando snapshot de tasas (seed, una sola vez)..."
node services/simulator/seed.js || fail "El seed de tasas falló"

# --- 5. Levantar servicios en orden SIM -> PER -> FE (R-ENV-06) -------------
# Vite escucha en 0.0.0.0 (host:true en vite.config) y el frontend resuelve los
# backends por el host de la URL, así que NO hace falta exportar IPs aquí.

log "Iniciando SIM (simulador/caché) en :${SIM_PORT}..."
node services/simulator/server.js & SIM_PID=$!

log "Iniciando PER (persistencia) en :${PERSIST_PORT}..."
node services/persistence/server.js & PER_PID=$!

log "Iniciando FE (mockup Vue) en :${FRONTEND_PORT}..."
( cd frontend && npm run dev ) & FE_PID=$!

cleanup() {
  log "Deteniendo servicios..."
  kill "$SIM_PID" "$PER_PID" "$FE_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

log "Entorno levantado. Frontend: http://localhost:${FRONTEND_PORT}"
wait
