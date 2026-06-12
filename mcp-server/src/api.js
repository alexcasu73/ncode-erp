/**
 * Client minimale verso la REST API ERP (api-server, /api/v1).
 * Inoltra la X-API-Key configurata: la company visibile dipende da quella chiave.
 */
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3002';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error('Variabile API_KEY richiesta nel file .env del MCP server');
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      // Filtri colonna: { filter: { campo: valore } } → filter[campo]=valore
      if (k === 'filter' && typeof v === 'object') {
        for (const [fk, fv] of Object.entries(v)) {
          if (fv !== undefined && fv !== null && fv !== '') url.searchParams.set(`filter[${fk}]`, fv);
        }
      } else {
        url.searchParams.set(k, v);
      }
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(`Errore API (${res.status}): ${msg}`);
  }
  return json;
}

export const api = {
  list: (resource, query) => request('GET', `/${resource}`, { query }),
  get: (resource, id) => request('GET', `/${resource}/${encodeURIComponent(id)}`),
  create: (resource, body) => request('POST', `/${resource}`, { body }),
  update: (resource, id, body) => request('PUT', `/${resource}/${encodeURIComponent(id)}`, { body }),
  remove: (resource, id) => request('DELETE', `/${resource}/${encodeURIComponent(id)}`),
};
