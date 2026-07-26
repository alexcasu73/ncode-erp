import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { supabase } from '../lib/supabase.js';
import { jwtAuth } from '../middleware/auth.js';

export const authKeysRouter = Router();

// Risolve la company_id dell'utente autenticato (qualsiasi membro attivo).
// Restituisce anche il role per eventuali check admin.
async function resolveCompany(userId) {
  const { data, error } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (error || !data) return null;
  return data; // { company_id, role }
}

// GET /auth/keys — lista le chiavi dell'utente corrente (e, se admin, anche quelle di company legacy)
authKeysRouter.get('/', jwtAuth, async (req, res, next) => {
  try {
    const membership = await resolveCompany(req.userId);
    if (!membership) return res.status(403).json({ error: 'Nessuna company associata all\'utente' });

    const isAdmin = membership.role === 'admin';
    const companyId = membership.company_id;

    // Le chiavi dell'utente corrente (user_id match) più, se admin,
    // le chiavi legacy di company senza user_id (user_id IS NULL).
    let query = supabase
      .from('api_keys')
      .select('id, label, key_prefix, created_at, last_used_at, revoked_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (isAdmin) {
      query = query.or(`user_id.eq.${req.userId},user_id.is.null`);
    } else {
      query = query.eq('user_id', req.userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /auth/keys — crea nuova chiave personale per l'utente corrente
authKeysRouter.post('/', jwtAuth, async (req, res, next) => {
  try {
    const membership = await resolveCompany(req.userId);
    if (!membership) return res.status(403).json({ error: 'Nessuna company associata all\'utente' });

    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Campo "label" obbligatorio' });

    // Genera chiave: ncode_<16 byte hex>
    const rawKey = `ncode_${randomBytes(16).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12); // "ncode_ab12cd"
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        company_id: membership.company_id,
        user_id: req.userId,
        label: label.trim(),
        key_prefix: keyPrefix,
        key_hash: keyHash,
      })
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
// L'utente revoca le proprie; gli admin possono revocare qualsiasi chiave della company.
authKeysRouter.delete('/:id', jwtAuth, async (req, res, next) => {
  try {
    const membership = await resolveCompany(req.userId);
    if (!membership) return res.status(403).json({ error: 'Nessuna company associata all\'utente' });

    const isAdmin = membership.role === 'admin';
    const match = isAdmin
      ? { id: req.params.id, company_id: membership.company_id }
      : { id: req.params.id, company_id: membership.company_id, user_id: req.userId };

    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .match(match);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/keys/:id/permanent — elimina definitivamente (solo chiavi già revocate)
authKeysRouter.delete('/:id/permanent', jwtAuth, async (req, res, next) => {
  try {
    const membership = await resolveCompany(req.userId);
    if (!membership) return res.status(403).json({ error: 'Nessuna company associata all\'utente' });

    const isAdmin = membership.role === 'admin';
    const match = isAdmin
      ? { id: req.params.id, company_id: membership.company_id }
      : { id: req.params.id, company_id: membership.company_id, user_id: req.userId };

    const { data: key, error: findErr } = await supabase
      .from('api_keys')
      .select('id, revoked_at')
      .match(match)
      .single();

    if (findErr || !key) return res.status(404).json({ error: 'Chiave non trovata' });
    if (!key.revoked_at) {
      return res.status(400).json({ error: 'Revoca la chiave prima di eliminarla definitivamente' });
    }

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .match(match);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});