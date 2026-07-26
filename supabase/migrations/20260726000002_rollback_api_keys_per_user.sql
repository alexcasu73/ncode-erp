-- Rollback della migration 20260726000001_api_keys_per_user.sql:
-- torna al modello company-level (solo admin generano chiavi per la company).

-- Ripristina le RLS originali (company-level, solo admin).
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;

CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Rimuove la colonna user_id (le eventuali chiavi per-utente create nel frattempo
-- vengono riassegnate alla company come legacy user_id NULL prima del drop).
UPDATE api_keys SET user_id = NULL WHERE user_id IS NOT NULL;
ALTER TABLE api_keys DROP COLUMN IF EXISTS user_id;
DROP INDEX IF EXISTS idx_api_keys_user_id;