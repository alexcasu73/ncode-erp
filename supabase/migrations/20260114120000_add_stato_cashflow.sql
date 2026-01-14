-- Add stato_fatturazione field to cashflow_records table
-- This allows each cashflow record to have its own independent status

ALTER TABLE cashflow_records
  ADD COLUMN IF NOT EXISTS stato_fatturazione TEXT CHECK (stato_fatturazione IN ('Stimato', 'Effettivo', 'Nessuno'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_cashflow_records_stato_fatturazione
  ON cashflow_records(stato_fatturazione);

-- Update existing records:
-- - If they have an invoice_id, copy the status from the invoice
-- - If they don't have an invoice_id (standalone), set to 'Nessuno'
UPDATE cashflow_records cf
SET stato_fatturazione = COALESCE(
  (SELECT stato_fatturazione FROM invoices WHERE id = cf.invoice_id),
  'Nessuno'
)
WHERE stato_fatturazione IS NULL;
