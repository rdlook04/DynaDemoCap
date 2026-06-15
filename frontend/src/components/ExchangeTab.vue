<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { fetchHealth, fetchRate, saveTransaction, fetchHistory } from '../api.js';

const CURRENCIES = ['USD', 'JPY', 'MXN', 'PEN', 'COP', 'EUR'];

const health = reactive({ status: 'unknown', currencyCount: 0, lastFetchAt: null, source: null });
const form = reactive({ base: 'USD', target: 'PEN', amount: 100 });

const quote = ref(null);
const error = ref('');
const saving = ref(false);
const loading = ref(false);
const history = ref([]);

const statusLabel = computed(() => {
  if (health.status === 'ready') return 'Caché lista';
  if (health.status === 'degraded') return 'Degradado';
  return 'Conectando…';
});

function swap() {
  const b = form.base;
  form.base = form.target;
  form.target = b;
  quote.value = null;
}

async function loadHealth() {
  try {
    Object.assign(health, await fetchHealth());
  } catch {
    health.status = 'degraded';
  }
}

async function loadHistory() {
  try {
    const res = await fetchHistory();
    history.value = res.items.slice().reverse();
  } catch {
    /* el panel de error principal cubre fallos de red */
  }
}

async function onQuote() {
  error.value = '';
  quote.value = null;
  loading.value = true;
  try {
    quote.value = await fetchRate({ base: form.base, target: form.target, amount: Number(form.amount) });
  } catch (e) {
    error.value = e.message || 'No se pudo obtener la tasa. Inténtalo de nuevo.';
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!quote.value) return;
  saving.value = true;
  error.value = '';
  try {
    await saveTransaction({
      base: quote.value.base,
      target: quote.value.target,
      amount: quote.value.amount,
      rate: quote.value.rate,
      convertedAmount: quote.value.convertedAmount,
      timestamp: new Date().toISOString(),
    });
    await loadHistory();
  } catch (e) {
    error.value = e.message || 'No se pudo guardar la transacción.';
  } finally {
    saving.value = false;
  }
}

function fmt(n) {
  return Number(n).toLocaleString('es-PE', { maximumFractionDigits: 4 });
}

onMounted(() => {
  loadHealth();
  loadHistory();
});
</script>

<template>
  <div>
    <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
      <span class="badge">
        <span class="dot" :class="health.status"></span>
        {{ statusLabel }} · {{ health.currencyCount }} monedas
      </span>
    </div>

    <div class="grid">
      <section class="card">
        <h2>Convertir</h2>
        <div class="row">
          <div>
            <label>De</label>
            <select v-model="form.base">
              <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label>A</label>
            <select v-model="form.target">
              <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="swap"><button type="button" @click="swap" title="Invertir">⇄</button></div>

        <div>
          <label>Monto</label>
          <input v-model.number="form.amount" type="number" min="0" step="0.01" />
        </div>

        <button class="btn" :disabled="loading" @click="onQuote">
          {{ loading ? 'Consultando…' : 'Consultar tasa' }}
        </button>

        <div v-if="error" class="alert">⚠️ {{ error }}</div>

        <div v-if="quote" class="result">
          <div class="big">{{ fmt(quote.convertedAmount) }} {{ quote.target }}</div>
          <div class="meta">
            {{ fmt(quote.amount) }} {{ quote.base }} · 1 {{ quote.base }} = {{ fmt(quote.rate) }} {{ quote.target }}
          </div>
          <div class="meta">Fuente: {{ quote.source }} · snapshot {{ new Date(quote.fetchedAt).toLocaleString('es-PE') }}</div>
          <button class="btn secondary" :disabled="saving" @click="onSave">
            {{ saving ? 'Guardando…' : 'Guardar transacción simulada' }}
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Estado del simulador</h2>
        <p class="meta" style="color: var(--muted); line-height: 1.7">
          El backend consultó <strong>exchangerate</strong> una sola vez y persistió el resultado como
          snapshot JSON. Todas las conversiones se sirven desde la caché en memoria, sin gastar cuota.
        </p>
        <table class="history" style="margin-top: 8px">
          <tbody>
            <tr><th>Estado</th><td>{{ health.status }}</td></tr>
            <tr><th>Monedas</th><td>{{ CURRENCIES.join(', ') }}</td></tr>
            <tr><th>Fuente</th><td>{{ health.source || '—' }}</td></tr>
            <tr><th>Último fetch</th><td>{{ health.lastFetchAt ? new Date(health.lastFetchAt).toLocaleString('es-PE') : '—' }}</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="card history">
      <h2>Transacciones simuladas guardadas</h2>
      <table v-if="history.length">
        <thead>
          <tr><th>Fecha</th><th>Par</th><th>Monto</th><th>Tasa</th><th>Convertido</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in history" :key="t.id">
            <td>{{ new Date(t.timestamp).toLocaleString('es-PE') }}</td>
            <td>{{ t.base }} → {{ t.target }}</td>
            <td>{{ fmt(t.amount) }} {{ t.base }}</td>
            <td>{{ fmt(t.rate) }}</td>
            <td>{{ fmt(t.convertedAmount) }} {{ t.target }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Aún no hay transacciones guardadas.</div>
    </section>
  </div>
</template>
