CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,        -- es: "ncode_Ab3x" — mostrato in UI
  key_hash TEXT NOT NULL UNIQUE,   -- SHA-256 della chiave completa
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_company_id ON api_keys(company_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Solo admin della company possono vedere/gestire le proprie chiavi
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
