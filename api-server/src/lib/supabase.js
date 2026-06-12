import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

// Node < 22 non ha WebSocket nativo: supabase-js (realtime) lo richiede.
// Forniamo un polyfill anche se la Realtime non viene usata da questo servizio.
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Variabili SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richieste nel file .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
