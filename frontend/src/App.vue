<script setup>
import { ref } from 'vue';
import ExchangeTab from './components/ExchangeTab.vue';
import FluentBitTab from './components/FluentBitTab.vue';
import LinuxConfigTab from './components/LinuxConfigTab.vue';

const tabs = [
  { id: 'exchange', label: 'Exchange Simulado', icon: '💱', comp: ExchangeTab },
  { id: 'fluentbit', label: 'Fluent Bit', icon: '📡', comp: FluentBitTab },
  { id: 'linux', label: 'Configuración Linux', icon: '🐧', comp: LinuxConfigTab },
];
const active = ref('exchange');
function currentComp() {
  return tabs.find((t) => t.id === active.value).comp;
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="brand">
        <div class="logo">DX</div>
        <h1>DynaDemoCap</h1>
      </div>
      <span class="badge"><span class="dot ready"></span>Demo · Observabilidad</span>
    </header>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: active === t.id }"
        @click="active = t.id"
      >
        <span class="ico">{{ t.icon }}</span>{{ t.label }}
      </button>
    </nav>

    <component :is="currentComp()" />

    <p class="foot">DynaDemoCap · Harness-SDD · f1_exchange_simulator + observabilidad Fluent Bit→Dynatrace</p>
  </div>
</template>
