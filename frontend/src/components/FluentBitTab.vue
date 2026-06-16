<script setup>
import { ref } from 'vue';

const copied = ref('');
function copy(text, id) {
  navigator.clipboard?.writeText(text);
  copied.value = id;
  setTimeout(() => (copied.value = ''), 1500);
}

const conf = `[INPUT]
    name              node_exporter_metrics
    tag               host.metrics
    scrape_interval   15
    metrics           meminfo,loadavg        # RAM + carga de CPU (gauges)

[OUTPUT]
    name              opentelemetry
    match             *
    host              \${DYNATRACE_HOST}
    metrics_uri       /api/v2/otlp/v1/metrics
    header            Authorization Api-Token \${DYNATRACE_API_TOKEN}`;

const deployAll = `# En el servidor: un solo comando levanta TODO (incluye Fluent Bit)
bash ~/DynaDemoCap/scripts/deploy-server.sh`;

const deployFB = `# 1) Token de Dynatrace (una sola vez)
cd ~/DynaDemoCap/fluent-bit
cp dynatrace.env.demo dynatrace.env       # pega tu token dt0c01... dentro

# 2) Metricas (RAM + carga de CPU) -> contenedor podman
podman run -d --name dynademocap-fluentbit --restart=always --security-opt label=disable \\
  --env-file ~/DynaDemoCap/fluent-bit/dynatrace.env \\
  -v ~/DynaDemoCap/fluent-bit/fluent-bit.podman.conf:/fluent-bit/etc/fluent-bit.conf:ro \\
  -v ~/DynaDemoCap/fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro \\
  -v /proc:/host/proc:ro -v /sys:/host/sys:ro \\
  docker.io/fluent/fluent-bit:latest

# 3) Log de auditoria -> contenedor docker (lee /var/log/audit)
docker run -d --name dynademocap-fluentbit-logs --restart=always --security-opt label=disable \\
  --env-file ~/DynaDemoCap/fluent-bit/dynatrace.env \\
  -v ~/DynaDemoCap/fluent-bit/fluent-bit.logs.conf:/fluent-bit/etc/fluent-bit.conf:ro \\
  -v ~/DynaDemoCap/fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro \\
  -v /var/log/audit:/host/audit:ro \\
  docker.io/fluent/fluent-bit:latest

# 4) Verificar que ambos corren
podman ps ; docker ps`;
</script>

<template>
  <div>
    <!-- Qué es -->
    <section class="card">
      <h2>¿Qué es Fluent Bit? (en simple)</h2>
      <p class="lead">
        Es un <strong>recolector muy ligero</strong> que vive dentro del servidor: toma información
        (datos de salud y registros de actividad) y la <strong>entrega a Dynatrace</strong> para
        verla en gráficos y tableros.
      </p>
      <div class="callout">
        <span class="emoji">📮</span>
        <p>Piénsalo como el <strong>cartero del servidor</strong>: no inventa la información, la
        <strong>recoge y la entrega</strong> puntualmente. Es pequeño, rápido y no estorba.</p>
      </div>
    </section>

    <!-- Por qué si ya hay OneAgent -->
    <section class="card" style="margin-top:20px;">
      <h2>¿Y si ya tenemos OneAgent?</h2>
      <p class="lead">
        El <strong>OneAgent</strong> de Dynatrace ya vigila el servidor solo (CPU, memoria, procesos…).
        <strong>Fluent Bit no lo reemplaza: lo complementa.</strong> Lo usamos cuando queremos enviar
        <em>datos específicos que nosotros elegimos</em>.
      </p>
      <div class="pieces">
        <div class="piece"><span class="pemoji">🤖</span><div><b>OneAgent</b><span>Lo automático: se instala y vigila todo el servidor sin configurar nada.</span></div></div>
        <div class="piece"><span class="pemoji">🧰</span><div><b>Fluent Bit</b><span>Lo a medida: tú decides qué archivo de logs o qué métrica enviar.</span></div></div>
      </div>
      <p class="muted-text" style="margin-top:10px;">Juntos = cobertura completa. No compiten, se complementan.</p>
    </section>

    <!-- Qué hace en esta demo -->
    <section class="card" style="margin-top:20px;">
      <h2>¿Qué está enviando ahora mismo?</h2>
      <p class="lead">En el servidor de la demo, Fluent Bit le manda a Dynatrace:</p>
      <div class="pieces">
        <div class="piece"><span class="pemoji">🧠</span><div><b>Memoria (RAM)</b><span>Cuánta memoria libre y total tiene el servidor.</span></div></div>
        <div class="piece"><span class="pemoji">⚙️</span><div><b>Carga de CPU</b><span>Qué tan ocupado está el procesador (load average).</span></div></div>
        <div class="piece"><span class="pemoji">📜</span><div><b>Log de auditoría</b><span>El registro de seguridad del servidor: quién hizo qué.</span></div></div>
      </div>
      <div style="margin-top:12px;">
        <span class="pill ok">✓ Enviando a Dynatrace</span>
        <span class="pill">dvq06456.live.dynatrace.com</span>
      </div>
    </section>

    <!-- Cómo desplegarlo -->
    <section class="card" style="margin-top:20px;">
      <h2>Cómo desplegarlo (pasos)</h2>
      <div class="callout">
        <span class="emoji">⚡</span>
        <p><strong>Forma fácil:</strong> en el servidor, un solo comando levanta todo — incluido Fluent Bit.</p>
      </div>
      <div class="codeblock">
        <button class="copy-btn" @click="copy(deployAll, 'da')">{{ copied === 'da' ? '¡Copiado!' : 'Copiar' }}</button>
        <pre>{{ deployAll }}</pre>
      </div>

      <p class="section-title">O paso a paso (solo Fluent Bit)</p>
      <ol class="steps">
        <li>Pon el <strong>token de Dynatrace</strong> en <code>dynatrace.env</code>.</li>
        <li>Levanta el contenedor de <strong>métricas</strong> (RAM + carga de CPU).</li>
        <li>Levanta el contenedor de <strong>logs</strong> (registro de auditoría).</li>
        <li>Verifica que <strong>ambos</strong> estén corriendo.</li>
      </ol>
      <div class="codeblock">
        <button class="copy-btn" @click="copy(deployFB, 'dfb')">{{ copied === 'dfb' ? '¡Copiado!' : 'Copiar' }}</button>
        <pre>{{ deployFB }}</pre>
      </div>
      <p class="muted-text" style="margin-top:8px;">
        Son <strong>dos contenedores</strong>: métricas en <em>podman</em> (sin permisos especiales) y
        logs en <em>docker</em> (para poder leer el registro de auditoría del sistema).
      </p>
    </section>

    <!-- Pasos demo -->
    <section class="card" style="margin-top:20px;">
      <h2>Qué vas a ver (pasos para la demo)</h2>
      <ol class="steps">
        <li>Abre <strong>Dynatrace</strong> en el navegador.</li>
        <li><strong>Métricas:</strong> entra a <em>Data Explorer</em> y busca <code>node_memory_MemAvailable_bytes</code> o <code>node_load1</code> → es la memoria y la carga que envió Fluent Bit.</li>
        <li><strong>Logs:</strong> entra a <em>Logs</em> y filtra por <code>log.source = "linux-auditd"</code> → verás llegar el registro de auditoría.</li>
        <li>Compara con la vista del <strong>OneAgent</strong> (el host completo) para mostrar cómo se complementan.</li>
      </ol>
    </section>

    <!-- Técnico opcional -->
    <section class="card" style="margin-top:20px;">
      <h2>Detalle técnico (opcional)</h2>
      <p class="muted-text">
        Para quien quiera ver el "cómo": esta es, en esencia, la configuración real. Envía solo
        <em>medidas instantáneas</em> (memoria, carga) porque este Dynatrace no acepta contadores acumulativos.
      </p>
      <div class="codeblock">
        <button class="copy-btn" @click="copy(conf, 'conf')">{{ copied === 'conf' ? '¡Copiado!' : 'Copiar' }}</button>
        <pre>{{ conf }}</pre>
      </div>
    </section>
  </div>
</template>
