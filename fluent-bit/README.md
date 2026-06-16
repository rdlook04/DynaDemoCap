# Fluent Bit → Dynatrace (métricas básicas)

Componente de observabilidad de la demo. Recolecta **métricas de host** del
servidor donde corre DynaDemoCap y las envía a **Dynatrace** vía OTLP/HTTP.
Esta es la versión base (v0); luego la iremos mejorando (logs de la app,
más métricas, dashboards).

## Qué recolecta

**Métricas** (`fluent-bit.podman.conf`, contenedor podman rootless):

| Input | Métricas |
|-------|----------|
| `node_exporter_metrics` | memoria, carga, filesystem, diskstats, filefd, temperatura, uname… (gauges) |
| `fluentbit_metrics` | Salud interna de Fluent Bit (throughput, retries, drops) |

Salida: plugin `opentelemetry` → OTLP de Dynatrace (`/api/v2/otlp/v1/metrics`).

> **Límite conocido (CPU):** los contadores acumulativos `*_total` (p.ej.
> `node_cpu_seconds_total`) son **rechazados** por el endpoint OTLP de Dynatrace
> (`UNSUPPORTED_METRIC_TYPE_MONOTONIC_CUMULATIVE_SUM`). El colector cpu sí
> funciona; para ingerir CPU hay que habilitar conversión *cumulative→delta* en
> Dynatrace. Las métricas gauge entran sin problema.

**Logs de auditoría** (`fluent-bit.logs.conf`, contenedor **docker**):

| Input | Origen | Salida |
|-------|--------|--------|
| `tail` | `/var/log/audit/audit.log` (auditd) | Dynatrace Log Ingest API (`/api/v2/logs/ingest`) |

El audit log es `root:root 0600`, por eso este pipeline corre en **docker**
(daemon root; `rgarzon` está en el grupo `docker`, sin sudo) con
`/var/log/audit` montado en `/host/audit`. Verificado: `HTTP status=204`.

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `fluent-bit.conf` | Configuración principal (inputs + output Dynatrace) |
| `parsers.conf` | Parsers (JSON listo para los logs de la app, fase siguiente) |
| `dynatrace.env.example` | Plantilla de credenciales (copiar a `dynatrace.env`) |
| `run.sh` | Carga `dynatrace.env` y lanza Fluent Bit |

## 1. Instalar Fluent Bit (Fedora)

```bash
# Script oficial (instala en /opt/fluent-bit) — requiere sudo
curl -fsSL https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh
```

> Alternativa con repo dnf: ver https://docs.fluentbit.io/manual/installation/linux/redhat-centos

## 2. Configurar credenciales de Dynatrace

Dos plantillas:
- `dynatrace.env.demo` → host del laboratorio **pre-rellenado**; solo pegas el token.
- `dynatrace.env.example` → plantilla genérica con `CHANGEME` para tu **propio** entorno.

```bash
# Demo (host ya puesto, solo pega el token):
cp dynatrace.env.demo dynatrace.env
#   DYNATRACE_API_TOKEN=dt0c01....   (scopes: metrics.ingest + logs.ingest)

# O para tu entorno propio:
cp dynatrace.env.example dynatrace.env
#   DYNATRACE_HOST=<env-id>.live.dynatrace.com   (sin https://)
#   DYNATRACE_API_TOKEN=dt0c01....
```

> El token **nunca** se versiona: vive solo en `dynatrace.env` (ignorado por git).
> `deploy.sh` omite Fluent Bit si el token sigue en `CHANGEME`.

## 3. Ejecutar

```bash
chmod +x run.sh
./run.sh
```

Health local de Fluent Bit mientras corre: http://localhost:2020

## 4. Verificar en Dynatrace

- **Data Explorer / Metrics** → busca las métricas (prefijos tipo `node_*`).
- Las series traen las etiquetas `host=dynademocap-server` y
  `service.name=dynademocap-fluentbit` para filtrarlas fácil.

## Notas

- `dynatrace.env` (con el token real) está **ignorado por git**.
- Las métricas básicas de host se leen de `/proc` y `/sys` (legibles sin root),
  así que Fluent Bit puede correr como usuario normal; la **instalación** sí
  requiere sudo.
- Endpoint SaaS por defecto. Para Dynatrace Managed/ActiveGate, ajusta
  `host` y `metrics_uri` (`/e/<env-id>/api/v2/otlp/v1/metrics`) en `fluent-bit.conf`.
