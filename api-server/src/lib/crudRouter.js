import { Router } from 'express';
import { supabase } from './supabase.js';

/**
 * Crea un router Express con operazioni CRUD standard su una tabella Supabase.
 * Tutte le query sono automaticamente scopate al company_id della chiave API.
 * @param {string} table - Nome della tabella
 * @param {object} opts
 * @param {string[]} [opts.searchFields] - Campi su cui filtrare con ?q=
 * @param {string} [opts.defaultSort] - Colonna di ordinamento default
 * @param {boolean} [opts.hasCompanyId] - Se false, non filtra per company_id (default: true)
 */
export function crudRouter(table, { searchFields = [], defaultSort = 'created_at', hasCompanyId = true } = {}) {
  const router = Router();

  // GET / — lista con paginazione, filtri e ordinamento
  router.get('/', async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;

      const sortParam = req.query.sort || defaultSort;
      const [sortCol, sortDir] = sortParam.includes(':') ? sortParam.split(':') : [sortParam, 'asc'];

      let query = supabase
        .from(table)
        .select('*', { count: 'exact' })
        .order(sortCol, { ascending: sortDir !== 'desc' })
        .range(offset, offset + limit - 1);

      if (hasCompanyId) {
        query = query.eq('company_id', req.companyId);
      }

      // Filtri colonna: ?filter[campo]=valore
      const filters = req.query.filter || {};
      for (const [col, val] of Object.entries(filters)) {
        query = query.eq(col, val);
      }

      // Ricerca testuale: ?q=testo
      if (req.query.q && searchFields.length > 0) {
        const conditions = searchFields.map(f => `${f}.ilike.%${req.query.q}%`).join(',');
        query = query.or(conditions);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      res.json({
        data,
        meta: { total: count, page, limit, pages: Math.ceil(count / limit) }
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /:id
  router.get('/:id', async (req, res, next) => {
    try {
      let query = supabase.from(table).select('*').eq('id', req.params.id);
      if (hasCompanyId) query = query.eq('company_id', req.companyId);

      const { data, error } = await query.single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Risorsa non trovata' });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // POST /
  router.post('/', async (req, res, next) => {
    try {
      const payload = hasCompanyId
        ? { ...req.body, company_id: req.companyId }
        : req.body;

      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id
  router.put('/:id', async (req, res, next) => {
    try {
      let query = supabase
        .from(table)
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      if (hasCompanyId) query = query.eq('company_id', req.companyId);

      const { data, error } = await query.select().single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Risorsa non trovata' });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id
  router.delete('/:id', async (req, res, next) => {
    try {
      let query = supabase.from(table).delete().eq('id', req.params.id);
      if (hasCompanyId) query = query.eq('company_id', req.companyId);

      const { error } = await query;
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
