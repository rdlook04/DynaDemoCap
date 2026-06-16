<script setup>
const APP_URL = 'http://192.168.217.147:8080';
</script>

<template>
  <div>
    <!-- Qué es -->
    <section class="card">
      <h2>¿Qué es esta demo?</h2>
      <p class="lead">
        Una aplicación que <strong>simula clientes reales usando un negocio</strong> (compras, pagos,
        recorridos de usuario) y lo muestra en <strong>Dynatrace</strong> con contexto de negocio
        (ingresos, eventos). Sirve para enseñar la <strong>observabilidad de negocio</strong> de punta a punta.
      </p>
      <div class="callout">
        <span class="emoji">🎯</span>
        <p>En vez de preguntar solo "¿el servidor está bien?", esta demo responde
        "<strong>¿cómo impacta esto al negocio?</strong>": ventas, recorridos de cliente, ingresos.</p>
      </div>
      <a class="linkbtn" :href="APP_URL" target="_blank" rel="noopener">Abrir la demo ↗ {{ APP_URL }}</a>
    </section>

    <!-- Piezas -->
    <section class="card" style="margin-top:20px;">
      <h2>Las piezas (y qué hace cada una)</h2>
      <div class="pieces">
        <div class="piece"><span class="pemoji">🖥️</span><div><b>La app (en el servidor)</b><span>Genera los recorridos de cliente y los eventos de negocio.</span></div></div>
        <div class="piece"><span class="pemoji">🤖</span><div><b>OneAgent</b><span>Vigila el servidor automáticamente y envía todo a Dynatrace.</span></div></div>
        <div class="piece"><span class="pemoji">🔌</span><div><b>EdgeConnect</b><span>Un túnel seguro que conecta el servidor con Dynatrace.</span></div></div>
        <div class="piece"><span class="pemoji">📡</span><div><b>Fluent Bit</b><span>Envía datos extra (métricas y logs) — ver la pestaña Fluent Bit.</span></div></div>
        <div class="piece"><span class="pemoji">🧠</span><div><b>Ollama (IA)</b><span>El modelo de IA que da inteligencia a los agentes. Corre en la laptop del presentador.</span></div></div>
      </div>
    </section>

    <!-- Cómo se conecta -->
    <section class="card" style="margin-top:20px;">
      <h2>Cómo se conecta todo</h2>
      <div class="flow">
        <span class="node">App + OneAgent<br>(servidor)</span>
        <span class="arrow">→</span>
        <span class="node">EdgeConnect<br>(túnel seguro)</span>
        <span class="arrow">→</span>
        <span class="node">Dynatrace<br>(tableros)</span>
      </div>
      <div class="flow">
        <span class="node">Agentes de IA<br>(en la app)</span>
        <span class="arrow">→</span>
        <span class="node">Ollama en la laptop<br>(192.168.217.1)</span>
      </div>
    </section>

    <!-- Pasos -->
    <section class="card" style="margin-top:20px;">
      <h2>Pasos para presentarla</h2>
      <ol class="steps">
        <li>Confirma que <strong>Ollama está encendido</strong> en tu laptop (da la inteligencia a los agentes).</li>
        <li>Abre la app en <code>{{ APP_URL }}</code></li>
        <li>Elige o crea un <strong>recorrido de cliente</strong> (customer journey) y genera tráfico.</li>
        <li>En Dynatrace, muestra los <strong>eventos de negocio (BizEvents)</strong> e ingresos apareciendo en vivo.</li>
        <li>Opcional: inyecta una falla con el agente de "caos" y muestra cómo Dynatrace la detecta.</li>
      </ol>
    </section>

    <!-- Estado -->
    <section class="card" style="margin-top:20px;">
      <h2>Estado actual</h2>
      <table class="history">
        <tbody>
          <tr><th>App (servidor)</th><td>✓ corriendo en {{ APP_URL }}</td></tr>
          <tr><th>EdgeConnect</th><td>✓ conectado a Dynatrace</td></tr>
          <tr><th>Ollama (IA)</th><td>✓ llama3.2:3b en la laptop</td></tr>
          <tr><th>OneAgent</th><td>✓ activo en el host</td></tr>
        </tbody>
      </table>
      <p class="muted-text" style="margin-top:10px;">
        Pendiente (permisos en Dynatrace): añadir <em>scopes</em> a los tokens para desplegar la UI en
        AppEngine y habilitar las consultas del asistente.
      </p>
    </section>
  </div>
</template>
