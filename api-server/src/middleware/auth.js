import { createHash } from 'crypto';
import { supabase } from '../lib/supabase.js';

export async function apiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    return res.status(401).json({ error: 'Header X-API-Key assente' });
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, company_id, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKey) {
    return res.status(401).json({ error: 'API key non valida' });
  }

  if (apiKey.revoked_at) {
    return res.status(401).json({ error: 'API key revocata' });
  }

  // Aggiorna last_used_at in background (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {});

  req.companyId = apiKey.company_id;
  next();
}

// Auth per gli endpoint di gestione chiavi: verifica JWT Supabase
export async function jwtAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token JWT assente' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Token JWT non valido o scaduto' });
  }

  req.userId = user.id;
  next();
}
