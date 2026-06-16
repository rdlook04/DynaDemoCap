<script setup>
import { ref } from 'vue';

const copied = ref('');
function copy(text, id) {
  navigator.clipboard?.writeText(text);
  copied.value = id;
  setTimeout(() => (copied.value = ''), 1500);
}

const steps = [
  {
    id: 'env',
    title: '1 · Credenciales de Dynatrace',
    note: 'Copia la plantilla y coloca tus valores (host de ingesta .live y token con scope metrics.ingest).',
    code: `cd ~/DynaDemoCap/fluent-bit
cp dynatrace.env.example dynatrace.env

# Edita dynatrace.env:
#   DYNATRACE_HOST=<env-id>.live.dynatrace.com
#   DYNATRACE_API_TOKEN=dt0c01....`,
  },
  {
    id: 'run',
    title: '2 · Métricas — RAM + carga CPU (podman rootless · sin sudo)',
    note: 'Monta /proc y /sys del host para métricas reales e inyecta las credenciales por --env-file.',
    code: `podman run -d --name dynademocap-fluentbit \\
  --restart=always \\
  --security-opt label=disable \\
  --env-file ~/DynaDemoCap/fluent-bit/dynatrace.env \\
  -v ~/DynaDemoCap/fluent-bit/fluent-bit.podman.conf:/fluent-bit/etc/fluent-bit.conf:ro \\
  -v ~/DynaDemoCap/fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro \\
  -v /proc:/host/proc:ro \\
  -v /sys:/host/sys:ro \\
  -p 127.0.0.1:2020:2020 \\
  docker.io/fluent/fluent-bit:latest`,
  },
  {
    id: 'run-logs',
    title: '3 · Logs de auditoría (docker · necesita root para leer /var/log/audit)',
    note: 'El audit log es solo root; este contenedor usa docker (daemon root) y monta /var/log/audit.',
    code: `docker run -d --name dynademocap-fluentbit-logs \\
  --restart=always \\
  --security-opt label=disable \\
  --env-file ~/DynaDemoCap/fluent-bit/dynatrace.env \\
  -v ~/DynaDemoCap/fluent-bit/fluent-bit.logs.conf:/fluent-bit/etc/fluent-bit.conf:ro \\
  -v ~/DynaDemoCap/fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro \\
  -v /var/log/audit:/host/audit:ro \\
  docker.io/fluent/fluent-bit:latest`,
  },
  {
    id: 'verify',
    title: '4 · Verificar',
    note: 'Logs del agente y contadores locales; debe verse HTTP status=200 hacia Dynatrace.',
    code: `podman logs --tail 20 dynademocap-fluentbit
curl -s http://127.0.0.1:2020/api/v1/metrics`,
  },
  {
    id: 'native',
    title: 'Alternativa · Instalación nativa (requiere sudo)',
    note: 'Si prefieres no usar contenedor, instala el binario y lanza con run.sh.',
    code: `curl -fsSL https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh
cd ~/DynaDemoCap/fluent-bit && chmod +x run.sh && ./run.sh`,
  },
];
</script>

<template>
  <div>
    <section class="card">
      <h2>Despliegue en Linux (Fedora)</h2>
      <p class="meta" style="color: var(--muted); line-height: 1.7">
        Servidor objetivo: <code>rgarzon@192.168.217.147</code>. El repositorio se clona en
        <code>~/DynaDemoCap</code> y Fluent Bit corre en contenedor <strong>rootless</strong>,
        así no requiere permisos de root. Requisitos: <code>podman</code> (o instalación nativa con sudo).
      </p>
    </section>

    <section v-for="s in steps" :key="s.id" class="card" style="margin-top:16px;">
      <h2>{{ s.title }}</h2>
      <p class="meta" style="color: var(--muted); margin-bottom:10px;">{{ s.note }}</p>
      <div class="codeblock">
        <button class="copy-btn" @click="copy(s.code, s.id)">{{ copied === s.id ? '¡Copiado!' : 'Copiar' }}</button>
        <pre>{{ s.code }}</pre>
      </div>
    </section>

    <section class="card" style="margin-top:16px;">
      <h2>Notas</h2>
      <ul class="meta" style="color: var(--muted); line-height:1.8; padding-left:18px;">
        <li>El host de <strong>ingesta</strong> es <code>.live.dynatrace.com</code> (la URL <code>.apps</code> es solo el UI).</li>
        <li><code>dynatrace.env</code> (con el token) está ignorado por git; nunca se versiona.</li>
        <li>Persistencia tras reinicio: <code>podman generate systemd</code> + <code>loginctl enable-linger</code> (servicio de usuario, sin sudo).</li>
        <li>Las métricas básicas de host se leen de <code>/proc</code> y <code>/sys</code> (legibles sin root).</li>
      </ul>
    </section>
  </div>
</template>
