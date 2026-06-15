<script setup>
import { ref } from 'vue';

const copied = ref('');
function copy(text, id) {
  navigator.clipboard?.writeText(text);
  copied.value = id;
  setTimeout(() => (copied.value = ''), 1500);
}

const inputs = [
  { name: 'node_exporter_metrics', desc: 'CPU, memoria, disco, red, carga y filesystem del host' },
  { name: 'fluentbit_metrics', desc: 'Salud interna del agente (throughput, reintentos, descartes)' },
];

const sample = [
  'node_load1',
  'node_memory_MemAvailable_bytes',
  'fluentbit_input_storage_chunks',
  'fluentbit_build_info',
];

const conf = `[SERVICE]
    flush             5
    log_level         info
    parsers_file      parsers.conf
    http_server       on
    http_listen       0.0.0.0
    http_port         2020

[INPUT]
    name              node_exporter_metrics
    tag               host.metrics
    scrape_interval   30
    path.procfs       /host/proc
    path.sysfs        /host/sys

[INPUT]
    name              fluentbit_metrics
    tag               fluentbit.metrics
    scrape_interval   30

[OUTPUT]
    name              opentelemetry
    match             *
    host              \${DYNATRACE_HOST}
    port              443
    metrics_uri       /api/v2/otlp/v1/metrics
    tls               on
    tls.verify        on
    header            Authorization Api-Token \${DYNATRACE_API_TOKEN}
    add_label         host dynademocap-server
    add_label         service.name dynademocap-fluentbit`;
</script>

<template>
  <div>
    <div class="grid">
      <section class="card">
        <h2>Qué hace</h2>
        <p class="meta" style="color: var(--muted); line-height: 1.7">
          Fluent Bit corre como contenedor <strong>podman rootless</strong> en el servidor y envía
          métricas a <strong>Dynatrace</strong> vía OTLP/HTTP. Lee el <code>/proc</code> y
          <code>/sys</code> del host montados, así reporta métricas reales de la máquina.
        </p>
        <div style="margin-top:14px;">
          <span class="pill">OTLP · /api/v2/otlp/v1/metrics</span>
          <span class="pill">dvq06456.live.dynatrace.com</span>
          <span class="pill ok">HTTP 200 · errors: 0</span>
        </div>
      </section>

      <section class="card">
        <h2>Estado</h2>
        <table class="history">
          <tbody>
            <tr><th>Contenedor</th><td>dynademocap-fluentbit</td></tr>
            <tr><th>Imagen</th><td>fluent/fluent-bit:latest</td></tr>
            <tr><th>Scrape</th><td>cada 30 s</td></tr>
            <tr><th>Dimensiones</th><td>host=dynademocap-server · service.name=dynademocap-fluentbit</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="card" style="margin-top:20px;">
      <h2>Qué recolecta</h2>
      <table class="history">
        <thead><tr><th>Input</th><th>Métricas</th></tr></thead>
        <tbody>
          <tr v-for="i in inputs" :key="i.name"><td><code>{{ i.name }}</code></td><td>{{ i.desc }}</td></tr>
        </tbody>
      </table>
      <p class="section-title">Ejemplos de métricas verificadas en Dynatrace</p>
      <div>
        <span v-for="m in sample" :key="m" class="pill">{{ m }}</span>
      </div>
    </section>

    <section class="card" style="margin-top:20px;">
      <h2>Configuración (fluent-bit.podman.conf)</h2>
      <div class="codeblock">
        <button class="copy-btn" @click="copy(conf, 'conf')">{{ copied === 'conf' ? '¡Copiado!' : 'Copiar' }}</button>
        <pre>{{ conf }}</pre>
      </div>
      <p class="meta" style="color: var(--muted); margin-top:10px;">
        El token no aparece aquí: la config referencia las variables
        <code>$&#123;DYNATRACE_HOST&#125;</code> y <code>$&#123;DYNATRACE_API_TOKEN&#125;</code>,
        que se inyectan desde <code>dynatrace.env</code> (fuera de git). Ver la pestaña
        <strong>Configuración Linux</strong> para el despliegue.
      </p>
    </section>
  </div>
</template>
