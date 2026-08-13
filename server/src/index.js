/**
 * Ncode ERP Server
 * Backend Express per gestire invio email e altre operazioni server-side
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createRemoteJWKSet } from 'jose';
import { createPool } from './db/pool.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createEmailRouter } from './routes/email.js';
import { createUsersRouter } from './routes/users.js';
import { createAuthRouter } from './routes/auth.js';
import { createAiProxyRouter } from './routes/aiProxy.js';

// Load environment variables
dotenv.config();

// JWKS di Supabase Auth: i token utente sono firmati in ES256 con chiave asimmetrica.
// La verifica usa la chiave pubblica esposta dall'endpoint JWKS di gotrue.
const supabaseJwks = process.env.SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// === SECURITY ===
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3004',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '5mb' }));

// === DATABASE ===
const pool = createPool(process.env.DATABASE_URL);

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ncode-erp-server'
  });
});

app.use('/api/email', createEmailRouter({ pool }));
app.use('/api/users', createUsersRouter({ pool }));
app.use('/api/auth', createAuthRouter());
app.use('/api/ai-proxy', createAiProxyRouter({ supabaseJwks }));

// === ERROR HANDLING ===
app.use(errorHandler());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// === START SERVER ===
async function start() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║              Ncode ERP Backend Server                 ║
╠═══════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}              ║
║  API Base URL: http://localhost:${PORT}/api              ║
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║  - GET    /api/health              Health check      ║
║  - POST   /api/email/send-invitation Send invite     ║
║  - POST   /api/email/test          Test email        ║
║  - POST   /api/users/create        Create user       ║
║  - DELETE /api/users/:userId       Delete user       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
