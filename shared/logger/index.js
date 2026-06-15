'use strict';

/**
 * Logger estructurado compartido (R-LOG-01..05).
 * Emite JSON de una línea por evento a stdout con esquema común.
 */

const { randomUUID } = require('crypto');

function newCorrelationId() {
  return randomUUID();
}

/** Extrae el correlationId entrante o genera uno nuevo (R-LOG-05). */
function getCorrelationId(headers = {}) {
  return (
    headers['x-correlation-id'] ||
    headers['X-Correlation-Id'] ||
    newCorrelationId()
  );
}

function createLogger(service) {
  function emit(level, event, message, data, correlationId) {
    const line = {
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
      correlationId: correlationId || null,
      message: message || '',
    };
    if (data && Object.keys(data).length > 0) line.data = data;
    process.stdout.write(JSON.stringify(line) + '\n');
  }

  return {
    info: (event, message, data, cid) => emit('info', event, message, data, cid),
    warn: (event, message, data, cid) => emit('warn', event, message, data, cid),
    error: (event, message, data, cid) => emit('error', event, message, data, cid),
  };
}

/**
 * Envuelve un handler HTTP con logging request.received / request.completed
 * incluyendo statusCode y latencyMs (R-LOG-02).
 */
function withRequestLogging(log, handler) {
  return function (req, res) {
    const correlationId = getCorrelationId(req.headers);
    req.correlationId = correlationId;
    const startedAt = Date.now();

    log.info('request.received', `${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
    }, correlationId);

    res.setHeader('x-correlation-id', correlationId);
    res.on('finish', () => {
      log.info('request.completed', `${req.method} ${req.url} -> ${res.statusCode}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        latencyMs: Date.now() - startedAt,
      }, correlationId);
    });

    try {
      handler(req, res, correlationId);
    } catch (err) {
      log.error('error', 'Error no controlado en el handler', { error: err.message }, correlationId);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Error interno' }));
    }
  };
}

module.exports = { createLogger, newCorrelationId, getCorrelationId, withRequestLogging };
