'use strict';

/**
 * Servicio Simulador / Caché (R-SIM-00..06).
 * Carga el snapshot JSON a memoria en el arranque (sin red) y sirve
 * todas las consultas de tasas desde la caché.
 */

const http = require('http');
const fs = require('fs');
const { URL } = require('url');
const { createLogger, withRequestLogging } = require('../../shared/logger');
const { PORT, SNAPSHOT_PATH, SUPPORTED } = require('./config');

const log = createLogger('sim');

// Estado de la caché en memoria (R-SIM-02).
const cache = {
  status: 'degraded',
  base: null,
  rates: {},
  fetchedAt: null,
  source: null,
  currencyCount: 0,
};

function loadSnapshot() {
  try {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    cache.base = snap.base;
    cache.rates = snap.rates || {};
    cache.fetchedAt = snap.fetchedAt;
    cache.source = snap.source;
    cache.currencyCount = Object.keys(cache.rates).length;
    cache.status = cache.currencyCount > 0 ? 'ready' : 'degraded';
    log.info('cache.bootstrap', 'Snapshot cargado en memoria', {
      currencyCount: cache.currencyCount,
      source: cache.source,
      base: cache.base,
    });
  } catch (err) {
    cache.status = 'degraded';
    log.error('cache.bootstrap', 'No se pudo cargar el snapshot; servicio degradado', {
      error: err.message,
      snapshot: SNAPSHOT_PATH,
    });
  }
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-correlation-id');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

function handleHealth(res) {
  // R-SIM-06: estado de caché, último fetch y nº de monedas.
  sendJson(res, 200, {
    status: cache.status,
    base: cache.base,
    lastFetchAt: cache.fetchedAt,
    source: cache.source,
    currencyCount: cache.currencyCount,
    supported: SUPPORTED,
  });
}

function handleRate(req, res, query, correlationId) {
  const base = (query.get('base') || '').toUpperCase();
  const target = (query.get('target') || '').toUpperCase();
  const amount = Number(query.get('amount') ?? '1');

  if (cache.status !== 'ready') {
    log.error('error', 'Consulta con caché no disponible', { base, target }, correlationId);
    return sendJson(res, 503, { error: 'CACHE_UNAVAILABLE', message: 'El servicio de tasas no está disponible' });
  }

  // R-SIM-00: validar dominio de monedas.
  for (const [label, code] of [['base', base], ['target', target]]) {
    if (!SUPPORTED.includes(code)) {
      log.warn('error', 'Moneda fuera de alcance', { label, code }, correlationId);
      return sendJson(res, 404, {
        error: 'CURRENCY_NOT_FOUND',
        message: `Moneda no soportada en ${label}: ${code || '(vacío)'}`,
        supported: SUPPORTED,
      });
    }
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return sendJson(res, 400, { error: 'INVALID_AMOUNT', message: 'El monto debe ser un número >= 0' });
  }

  // R-SIM-03: tasa derivada del snapshot (rate(target)/rate(base)).
  const rate = cache.rates[target] / cache.rates[base];
  const convertedAmount = Number((amount * rate).toFixed(6));

  sendJson(res, 200, {
    base,
    target,
    rate: Number(rate.toFixed(8)),
    amount,
    convertedAmount,
    fetchedAt: cache.fetchedAt,
    source: cache.source,
  });
}

const server = http.createServer(
  withRequestLogging(log, (req, res, correlationId) => {
    applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsed = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && parsed.pathname === '/health') {
      return handleHealth(res);
    }
    if (req.method === 'GET' && parsed.pathname === '/rate') {
      return handleRate(req, res, parsed.searchParams, correlationId);
    }

    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Ruta no encontrada' });
  })
);

loadSnapshot();
server.listen(PORT, () => {
  log.info('service.started', `Simulador escuchando en :${PORT}`, { port: PORT });
});
