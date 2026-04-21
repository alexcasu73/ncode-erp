-- Tabella per i template degli estratti conto bancari
-- Sostituisce la precedente gestione in localStorage

CREATE TABLE IF NOT EXISTS bank_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  header_row_index INTEGER NOT NULL,
  data_start_row INTEGER NOT NULL,
  columns JSONB NOT NULL DEFAULT '{}',
  importo_type TEXT NOT NULL CHECK (importo_type IN ('signed', 'separate')),
  positive_is_entrata BOOLEAN NOT NULL DEFAULT true,
  sample_preview TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Un solo template default per azienda
CREATE UNIQUE INDEX bank_templates_company_default
  ON bank_templates (company_id)
  WHERE is_default = true;

CREATE INDEX idx_bank_templates_company_id ON bank_templates (company_id);

ALTER TABLE bank_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members can manage bank templates"
  ON bank_templates FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER update_bank_templates_updated_at
  BEFORE UPDATE ON bank_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
