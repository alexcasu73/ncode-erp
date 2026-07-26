-- API keys diventano per-utente: ogni utente (anche non admin) può generare
-- i propri token personali per collegare client MCP / integrazioni esterne.
-- La chiave resta legata alla company dell'utente (multi-tenant).

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Le chiavi create prima di questa migration (legacy, company-level) hanno
-- user_id NULL. Rimangono valide come chiavi di company (retrocompatibilità).

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id) WHERE user_id IS NOT NULL;

-- RLS: ogni utente vede e gestisce le PROPRIE chiavi (user_id = auth.uid()).
-- Gli admin conservano la visibilità su tutte le chiavi della company.

DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
CREATE POLICY "api_keys_update" ON api_keys
  FOR UPDATE USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;
CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );