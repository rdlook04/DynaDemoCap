'use strict';

/**
 * Servicio de Persistencia (R-PER-01..04).
 * Persiste transacciones simuladas en un almacén local JSONL y expone el histórico.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { randomUUID } = require('crypto');
const { createLogger, withRequestLogging } = require('../../shared/logger');

const log = createLogger('per');
const PORT = Number(process.env.PERSIST_PORT) || 4002;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'transactions.jsonl');

const REQUIRED_FIELDS = ['base', 'target', 'amount', 'rate', 'convertedAmount'];

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, '', 'utf8');
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-correlation-id');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Payload demasiado grande'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function validate(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['El cuerpo debe ser un objeto JSON'];
  }
  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      errors.push(`Campo requerido faltante: ${field}`);
    }
  }
  for (const numField of ['amount', 'rate', 'convertedAmount']) {
    if (payload[numField] !== undefined && !Number.isFinite(Number(payload[numField]))) {
      errors.push(`Campo numérico inválido: ${numField}`);
    }
  }
  return errors;
}

async function handleCreate(req, res, correlationId) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, 400, { error: 'INVALID_JSON', message: 'JSON malformado' });
  }

  // R-PER-03: validación; sin persistencia parcial.
  const errors = validate(payload);
  if (errors.length) {
    log.warn('transaction.rejected', 'Payload inválido', { errors }, correlationId);
    return sendJson(res, 400, { error: 'VALIDATION_ERROR', message: 'Payload inválido', details: errors });
  }

  const record = {
    id: randomUUID(),
    base: String(payload.base).toUpperCase(),
    target: String(payload.target).toUpperCase(),
    amount: Number(payload.amount),
    rate: Number(payload.rate),
    convertedAmount: Number(payload.convertedAmount),
    timestamp: payload.timestamp || new Date().toISOString(),
    correlationId,
  };

  try {
    fs.appendFileSync(STORE_PATH, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    log.error('error', 'No se pudo persistir la transacción', { error: err.message }, correlationId);
    return sendJson(res, 500, { error: 'PERSIST_ERROR', message: 'No se pudo guardar la transacción' });
  }

  log.info('transaction.saved', 'Transacción persistida', { id: record.id }, correlationId);
  sendJson(res, 201, { id: record.id, ...record });
}

function readAll() {
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function handleList(res, correlationId) {
  let items = [];
  try {
    items = readAll();
  } catch (err) {
    log.error('error', 'No se pudo leer el histórico', { error: err.message }, correlationId);
    return sendJson(res, 500, { error: 'READ_ERROR', message: 'No se pudo leer el histórico' });
  }
  sendJson(res, 200, { count: items.length, items });
}

const server = http.createServer(
  withRequestLogging(log, async (req, res, correlationId) => {
    applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsed = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && parsed.pathname === '/health') {
      return sendJson(res, 200, { status: 'ready', store: 'transactions.jsonl' });
    }
    if (req.method === 'POST' && parsed.pathname === '/transactions') {
      return handleCreate(req, res, correlationId);
    }
    if (req.method === 'GET' && parsed.pathname === '/transactions') {
      return handleList(res, correlationId);
    }

    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Ruta no encontrada' });
  })
);

ensureStore();
server.listen(PORT, () => {
  log.info('service.started', `Persistencia escuchando en :${PORT}`, { port: PORT });
});
