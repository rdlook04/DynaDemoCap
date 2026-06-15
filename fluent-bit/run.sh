#!/usr/bin/env bash
# ============================================================================
# Lanza Fluent Bit cargando las credenciales de Dynatrace desde dynatrace.env
# ============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -f dynatrace.env ]; then
  echo "[fluent-bit] Falta dynatrace.env (copia dynatrace.env.example y edítalo)" >&2
  exit 1
fi
set -a; . ./dynatrace.env; set +a

: "${DYNATRACE_HOST:?Define DYNATRACE_HOST en dynatrace.env}"
: "${DYNATRACE_API_TOKEN:?Define DYNATRACE_API_TOKEN en dynatrace.env}"

# Ubicación típica del binario instalado por el script oficial: /opt/fluent-bit/bin
BIN="$(command -v fluent-bit || echo /opt/fluent-bit/bin/fluent-bit)"
if [ ! -x "$BIN" ]; then
  echo "[fluent-bit] No se encontró el binario fluent-bit. Instálalo (ver README.md)." >&2
  exit 1
fi

echo "[fluent-bit] Enviando métricas a https://${DYNATRACE_HOST}/api/v2/otlp/v1/metrics"
exec "$BIN" -c "$DIR/fluent-bit.conf"
