-- Migration to convert invoice IDs from "Fattura_202" to "202/2026" format

-- Step 1: Temporarily disable foreign key constraints
ALTER TABLE cashflow_records
  DROP CONSTRAINT IF EXISTS cashflow_records_invoice_id_fkey;

ALTER TABLE bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_matched_invoice_id_fkey;

-- Step 2: Create a mapping table for old -> new IDs
CREATE TEMP TABLE invoice_id_mapping (
  old_id TEXT,
  new_id TEXT
);

-- Step 3: Generate mappings (Fattura_202 -> 202/2026)
INSERT INTO invoice_id_mapping (old_id, new_id)
SELECT
  id,
  REPLACE(id, 'Fattura_', '') || '/' || anno
FROM invoices;

-- Step 4: Update foreign key references in cashflow_records
UPDATE cashflow_records cf
SET invoice_id = m.new_id
FROM invoice_id_mapping m
WHERE cf.invoice_id = m.old_id;

-- Step 5: Update foreign key references in bank_transactions
UPDATE bank_transactions bt
SET matched_invoice_id = m.new_id
FROM invoice_id_mapping m
WHERE bt.matched_invoice_id = m.old_id;

-- Step 6: Update invoices table primary keys
UPDATE invoices i
SET id = m.new_id
FROM invoice_id_mapping m
WHERE i.id = m.old_id;

-- Step 7: Restore foreign key constraints
ALTER TABLE cashflow_records
  ADD CONSTRAINT cashflow_records_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_matched_invoice_id_fkey
  FOREIGN KEY (matched_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- Step 8: Drop the temp mapping table
DROP TABLE invoice_id_mapping;
