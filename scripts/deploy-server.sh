#!/usr/bin/env bash
# ============================================================================
# DynaDemoCap · Deploy en servidor (GitOps)
# ----------------------------------------------------------------------------
# Trae la última versión del repo (git) y (re)levanta TODO en la VM:
#   - Backends SIM + PER  y frontend Vue (Vite, expuesto en 0.0.0.0)
#   - Fluent Bit: métricas (podman) y logs de auditoría (docker), si hay creds
#
# Uso en la VM:   bash ~/DynaDemoCap/scripts/deploy-server.sh
# Idempotente: detiene instancias previas y vuelve a levantar.
#
# El cuerpo va dentro de main() y se invoca en la última línea: así bash lee
# todo el script ANTES de que 'git reset' pueda reescribir este mismo archivo.
# ============================================================================
set -euo pipefail

main() {
  local ROOT="$HOME/DynaDemoCap"
  cd "$ROOT"

  echo "[deploy] 1/6 · Trayendo última versión del repo (git)…"
  git fetch origin
  git reset --hard origin/main

  echo "[deploy] 2/6 · Cargando entorno (.env)…"
  [ -f .env ] || cp .env.example .env
  set -a; . ./.env; set +a

  echo "[deploy] 3/6 · Dependencias del frontend…"
  npm install --prefix frontend >/tmp/fe-install.log 2>&1 || { echo "[deploy] npm install falló"; tail -15 /tmp/fe-install.log; }

  echo "[deploy] 4/6 · Seed de tasas (1 sola vez)…"
  node services/simulator/seed.js || true

  echo "[deploy] 5/6 · (Re)levantando SIM + PER + FE (detached)…"
  pkill -f "services/simulator/server.js"   2>/dev/null || true
  pkill -f "services/persistence/server.js" 2>/dev/null || true
  pkill -f "vite"                            2>/dev/null || true
  sleep 1
  setsid bash -c "cd '$ROOT' && set -a; . ./.env; set +a; node services/simulator/server.js   > sim.log 2>&1" </dev/null &
  setsid bash -c "cd '$ROOT' && set -a; . ./.env; set +a; node services/persistence/server.js  > per.log 2>&1" </dev/null &
  setsid bash -c "cd '$ROOT/frontend' && set -a; . '$ROOT/.env'; set +a; npm run dev > '$ROOT/fe.log' 2>&1" </dev/null &

  echo "[deploy] 6/6 · (Re)levantando Fluent Bit…"
  # Si no hay credenciales, parte de la plantilla .demo (host pre-rellenado)
  if [ ! -f fluent-bit/dynatrace.env ] && [ -f fluent-bit/dynatrace.env.demo ]; then
    cp fluent-bit/dynatrace.env.demo fluent-bit/dynatrace.env
    echo "[deploy]   creado dynatrace.env desde la plantilla .demo"
  fi
  if [ -f fluent-bit/dynatrace.env ] && ! grep -q "CHANGEME" fluent-bit/dynatrace.env; then
    # Métricas (podman rootless)
    podman rm -f dynademocap-fluentbit >/dev/null 2>&1 || true
    podman run -d --name dynademocap-fluentbit --restart=always --security-opt label=disable \
      --env-file "$ROOT/fluent-bit/dynatrace.env" \
      -v "$ROOT/fluent-bit/fluent-bit.podman.conf":/fluent-bit/etc/fluent-bit.conf:ro \
      -v "$ROOT/fluent-bit/parsers.conf":/fluent-bit/etc/parsers.conf:ro \
      -v /proc:/host/proc:ro -v /sys:/host/sys:ro \
      -p 127.0.0.1:2020:2020 \
      docker.io/fluent/fluent-bit:latest >/dev/null && echo "[deploy]   métricas: OK" || echo "[deploy]   métricas: omitido"
    # Logs de auditoría (docker · necesita root para leer /var/log/audit)
    docker rm -f dynademocap-fluentbit-logs >/dev/null 2>&1 || true
    docker run -d --name dynademocap-fluentbit-logs --restart=always --security-opt label=disable \
      --env-file "$ROOT/fluent-bit/dynatrace.env" \
      -v "$ROOT/fluent-bit/fluent-bit.logs.conf":/fluent-bit/etc/fluent-bit.conf:ro \
      -v "$ROOT/fluent-bit/parsers.conf":/fluent-bit/etc/parsers.conf:ro \
      -v /var/log/audit:/host/audit:ro \
      docker.io/fluent/fluent-bit:latest >/dev/null && echo "[deploy]   logs: OK" || echo "[deploy]   logs: omitido"
  else
    echo "[deploy]   Fluent Bit omitido: pega tu token en fluent-bit/dynatrace.env (aún tiene CHANGEME)"
  fi

  local IP; IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "[deploy] ✅ Listo. Frontend expuesto en: http://${IP:-<ip-servidor>}:${FRONTEND_PORT:-5173}"
}

main "$@"
