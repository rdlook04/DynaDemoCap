'use strict';

/**
 * Seed de tasas (R-SIM-01, R-SIM-01b, R-NFR-02).
 * Realiza UNA única llamada a exchangerate para las 6 monedas soportadas
 * y materializa el snapshot JSON versionado en el repositorio.
 * Si el snapshot ya existe, NO vuelve a llamar a la API (R-SIM-01c).
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../shared/logger');
const { SNAPSHOT_PATH, BASE, SUPPORTED, FALLBACK_RATES } = require('./config');

const log = createLogger('sim');

async function fetchFromApi() {
  const apiKey = process.env.EXCHANGERATE_API_KEY;
  const baseUrl = process.env.EXCHANGERATE_BASE_URL;

  if (!apiKey || !baseUrl) {
    log.warn('seed.no_credentials', 'Sin EXCHANGERATE_API_KEY/URL; se usará fallback embebido', {});
    return null;
  }

  const symbols = SUPPORTED.join(',');
  const url = `${baseUrl}?base=${BASE}&symbols=${symbols}&access_key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    // Tolerar varias formas de respuesta comunes en proveedores de exchangerate.
    const raw = body.rates || body.conversion_rates || body.data;
    if (!raw || typeof raw !== 'object') throw new Error('Formato de respuesta inesperado');

    const rates = {};
    for (const c of SUPPORTED) {
      if (raw[c] != null) rates[c] = Number(raw[c]);
    }
    rates[BASE] = rates[BASE] || 1;

    const missing = SUPPORTED.filter((c) => rates[c] == null);
    if (missing.length) throw new Error(`Faltan monedas en la respuesta: ${missing.join(',')}`);

    return rates;
  } catch (err) {
    log.warn('seed.fetch_failed', 'Falló el fetch a exchangerate; se usará fallback embebido', {
      error: err.message,
    });
    return null;
  }
}

async function main() {
  if (fs.existsSync(SNAPSHOT_PATH)) {
    log.info('seed.skip', 'El snapshot ya existe; no se llama a la API externa', {
      path: SNAPSHOT_PATH,
    });
    return;
  }

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });

  let rates = await fetchFromApi();
  let source = 'exchangerate';
  if (!rates) {
    rates = { ...FALLBACK_RATES };
    source = 'fallback';
  }

  const snapshot = {
    base: BASE,
    fetchedAt: new Date().toISOString(),
    source,
    supported: SUPPORTED,
    rates,
  };

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  log.info('cache.bootstrap', 'Snapshot de tasas generado', {
    path: SNAPSHOT_PATH,
    source,
    currencyCount: Object.keys(rates).length,
  });
}

main().catch((err) => {
  log.error('seed.fatal', 'Error fatal en el seed de tasas', { error: err.message });
  process.exit(1);
});
