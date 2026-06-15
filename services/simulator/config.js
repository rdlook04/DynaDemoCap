'use strict';
const path = require('path');

/** Configuración compartida entre el seed y el servidor del SIM. */
module.exports = {
  SERVICE: 'sim',
  PORT: Number(process.env.SIM_PORT) || 4001,
  SNAPSHOT_PATH: path.join(__dirname, 'data', 'rates.snapshot.json'),
  // Dominio fijo de monedas soportadas (R-SIM-00). Base de cálculo: USD.
  BASE: 'USD',
  SUPPORTED: ['USD', 'JPY', 'MXN', 'PEN', 'COP', 'EUR'],
  // Fallback embebido para que la demo sea ejecutable sin clave real.
  FALLBACK_RATES: {
    USD: 1,
    EUR: 0.92,
    JPY: 156.3,
    MXN: 18.7,
    PEN: 3.75,
    COP: 4050.0,
  },
};
