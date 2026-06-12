import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';

const PORT = process.env.MCP_PORT || 3003;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

/** Crea una nuova istanza MCP con i tool registrati (una per richiesta, modalità stateless). */
function createMcpServer() {
  const server = new McpServer({ name: 'ncode-erp-mcp', version: '1.0.0' });
  registerTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

// Protezione opzionale dell'endpoint MCP con bearer token
function authorized(req, res) {
  if (!AUTH_TOKEN) return true;
  if (req.headers['authorization'] === `Bearer ${AUTH_TOKEN}`) return true;
  res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Non autorizzato' }, id: null });
  return false;
}

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Endpoint MCP (Streamable HTTP) — modalità stateless: nuovo server+transport per richiesta
app.post('/mcp', async (req, res) => {
  if (!authorized(req, res)) return;
  const server = createMcpServer();
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
  console.log(`[MCP] ncode-erp-mcp in ascolto su http://localhost:${PORT}/mcp (Streamable HTTP)`);
  console.log(`[MCP] API target: ${process.env.API_BASE_URL || 'http://127.0.0.1:3002'}`);
  console.log(`[MCP] Auth bearer: ${AUTH_TOKEN ? 'attiva' : 'DISATTIVATA'}`);
});
