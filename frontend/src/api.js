// Cliente HTTP del frontend. Propaga x-correlation-id de extremo a extremo (R-LOG-05).

/* global __SIM_URL__, __PER_URL__ */
const SIM_URL = __SIM_URL__;
const PER_URL = __PER_URL__;

function correlationId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function parseError(res) {
  const body = await res.json().catch(() => ({}));
  return new Error(body.message || `Error ${res.status}`);
}

export async function fetchHealth() {
  const res = await fetch(`${SIM_URL}/health`, {
    headers: { 'x-correlation-id': correlationId() },
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchRate({ base, target, amount }) {
  const url = `${SIM_URL}/rate?base=${encodeURIComponent(base)}&target=${encodeURIComponent(
    target
  )}&amount=${encodeURIComponent(amount)}`;
  const res = await fetch(url, { headers: { 'x-correlation-id': correlationId() } });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function saveTransaction(payload) {
  const res = await fetch(`${PER_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch(`${PER_URL}/transactions`, {
    headers: { 'x-correlation-id': correlationId() },
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export { SIM_URL, PER_URL };
