import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { supabase } from '../lib/supabase.js';
import { jwtAuth } from '../middleware/auth.js';

export const authKeysRouter = Router();

// Risolve la company_id dell'utente autenticato
async function resolveCompanyId(userId) {
  const { data, error } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1)
    .single();
  if (error || !data) return null;
  return data.company_id;
}

// GET /auth/keys — lista chiavi della propria company
authKeysRouter.get('/', jwtAuth, async (req, res, next) => {
  try {
    const companyId = await resolveCompanyId(req.userId);
    if (!companyId) return res.status(403).json({ error: 'Accesso riservato agli admin' });

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, label, key_prefix, created_at, last_used_at, revoked_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /auth/keys — crea nuova chiave
authKeysRouter.post('/', jwtAuth, async (req, res, next) => {
  try {
    const companyId = await resolveCompanyId(req.userId);
    if (!companyId) return res.status(403).json({ error: 'Accesso riservato agli admin' });

    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Campo "label" obbligatorio' });

    // Genera chiave: ncode_<16 byte hex>
    const rawKey = `ncode_${randomBytes(16).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12); // "ncode_ab12cd"
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await supabase
      .from('api_keys')
      .insert({ company_id: companyId, label: label.trim(), key_prefix: keyPrefix, key_hash: keyHash })
      .select('id, label, key_prefix, created_at')
      .single();

    if (error) throw error;

    // Restituisce la chiave in chiaro UNA SOLA VOLTA
    res.status(201).json({ data: { ...data, key: rawKey } });
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/keys/:id — revoca chiave (soft delete)
authKeysRouter.delete('/:id', jwtAuth, async (req, res, next) => {
  try {
    const companyId = await resolveCompanyId(req.userId);
    if (!companyId) return res.status(403).json({ error: 'Accesso riservato agli admin' });

    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('company_id', companyId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
