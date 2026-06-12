import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();

import { apiKeyAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { customersRouter } from './routes/customers.js';
import { dealsRouter } from './routes/deals.js';
import { invoicesRouter } from './routes/invoices.js';
import { cashflowRouter } from './routes/cashflow.js';
import { transactionsRouter } from './routes/transactions.js';
import { bankTransactionsRouter } from './routes/bankTransactions.js';
import { reconciliationSessionsRouter } from './routes/reconciliationSessions.js';
import { companiesRouter } from './routes/companies.js';
import { usersRouter } from './routes/users.js';
import { authKeysRouter } from './routes/authKeys.js';

const app = express();
const PORT = process.env.API_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health — no auth
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// OpenAPI spec — no auth
app.get('/openapi.json', (req, res) => res.json(buildOpenApiSpec(req)));

// Gestione chiavi API (autenticazione via JWT Supabase, no X-API-Key)
app.use('/auth/keys', authKeysRouter);

// Tutte le route /api/v1/* richiedono X-API-Key
app.use('/api/v1', apiKeyAuth);

app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/deals', dealsRouter);
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/cashflow', cashflowRouter);
app.use('/api/v1/transactions', transactionsRouter);
app.use('/api/v1/bank-transactions', bankTransactionsRouter);
app.use('/api/v1/reconciliation-sessions', reconciliationSessionsRouter);
app.use('/api/v1/companies', companiesRouter);
app.use('/api/v1/users', usersRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API Server] in ascolto su http://localhost:${PORT}`);
  console.log(`[API Server] spec OpenAPI → http://localhost:${PORT}/openapi.json`);
});

function buildOpenApiSpec(req) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const resources = [
    { path: 'customers', tag: 'Clienti' },
    { path: 'deals', tag: 'Deal' },
    { path: 'invoices', tag: 'Fatture' },
    { path: 'cashflow', tag: 'Cashflow' },
    { path: 'transactions', tag: 'Transazioni' },
    { path: 'bank-transactions', tag: 'Movimenti bancari' },
    { path: 'reconciliation-sessions', tag: 'Sessioni riconciliazione' },
    { path: 'companies', tag: 'Aziende' },
    { path: 'users', tag: 'Utenti' },
  ];

  const listParams = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Numero di pagina' },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 }, description: 'Elementi per pagina' },
    { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Es: created_at:desc' },
    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Ricerca testuale' },
  ];

  const paths = {};
  for (const { path, tag } of resources) {
    paths[`/api/v1/${path}`] = {
      get: {
        tags: [tag],
        summary: `Lista ${tag}`,
        parameters: listParams,
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListResponse' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: [tag],
        summary: `Crea ${tag}`,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          201: { description: 'Creato' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    };
    paths[`/api/v1/${path}/{id}`] = {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: [tag],
        summary: `Dettaglio ${tag}`,
        responses: {
          200: { description: 'OK' },
          404: { description: 'Non trovato' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      put: {
        tags: [tag],
        summary: `Aggiorna ${tag}`,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'OK' },
          404: { description: 'Non trovato' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      delete: {
        tags: [tag],
        summary: `Elimina ${tag}`,
        responses: {
          204: { description: 'Eliminato' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Ncode ERP API', version: '1.0.0', description: 'API REST machine-to-machine per accesso ai dati ERP' },
    servers: [{ url: baseUrl }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        ListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                pages: { type: 'integer' },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: { description: 'API key non valida o assente', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
      },
    },
    paths,
  };
}
