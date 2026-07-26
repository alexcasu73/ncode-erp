import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { createApi } from './api.js';

const PORT = process.env.MCP_PORT || 3003;

// Token opzionale per proteggere l'endpoint /mcp da accessi anonimi.
// Se valorizzato, il client deve inviarlo come `Authorization: Bearer <MCP_AUTH_TOKEN>`;
// in quel caso la API key dell'azienda (multi-tenant) va passata in `X-API-Key`.
// Se vuoto, l'endpoint resta multi-tenant con la company key nel bearer (retrocompatibile).
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';
const mcpAuthEnabled = MCP_AUTH_TOKEN.length > 0;

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Crea una nuova istanza MCP con i tool registrati (una per richiesta, modalità stateless).
 * La API key dell'azienda arriva dal bearer del client e viene usata come X-API-Key.
 */
function createMcpServer(apiKey) {
  const server = new McpServer({ name: 'ncode-erp-mcp', version: '1.0.0' });
  registerTools(server, createApi(apiKey));
  return server;
}

// Estrae la API key dalla richiesta: header Authorization: Bearer <key> oppure X-API-Key
function extractApiKey(req) {
  const auth = req.headers['authorization'];
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  return null;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Endpoint MCP (Streamable HTTP) — stateless: nuovo server+transport per richiesta.
// Multi-tenant: ogni azienda si autentica con la propria API key (bearer).
app.post('/mcp', async (req, res) => {
  let apiKey;

  if (mcpAuthEnabled) {
    const auth = req.headers['authorization'];
    const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!bearer || !safeEqual(bearer, MCP_AUTH_TOKEN)) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Token MCP non valido (Authorization: Bearer <MCP_AUTH_TOKEN>)' },
        id: null,
      });
    }
    apiKey = req.headers['x-api-key'] ? String(req.headers['x-api-key']).trim() : null;
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'API key mancante (header X-API-Key: <ncode_...>)' },
        id: null,
      });
    }
  } else {
    apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'API key mancante (Authorization: Bearer <chiave>)' },
        id: null,
      });
    }
  }

  const server = createMcpServer(apiKey);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] errore richiesta:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Errore interno' }, id: null });
    }
  }
});

// In modalità stateless GET (stream SSE persistente) e DELETE non sono supportati
const methodNotAllowed = (req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Metodo non consentito' }, id: null });
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.listen(PORT, () => {
  console.log(`[MCP] ncode-erp-mcp in ascolto su http://localhost:${PORT}/mcp (Streamable HTTP, multi-tenant)`);
  console.log(`[MCP] API target: ${process.env.API_BASE_URL || 'http://127.0.0.1:3002'}`);
});
