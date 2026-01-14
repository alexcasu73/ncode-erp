-- Step 1: Remove default from cashflow_records
ALTER TABLE cashflow_records
  ALTER COLUMN id DROP DEFAULT;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS generate_cashflow_id() CASCADE;

-- Step 3: Create sequence
CREATE SEQUENCE IF NOT EXISTS cashflow_id_seq START WITH 1;

-- Step 4: Create new function
CREATE OR REPLACE FUNCTION generate_cashflow_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CF-' || LPAD(nextval('cashflow_id_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Step 5: Set new default
ALTER TABLE cashflow_records
  ALTER COLUMN id SET DEFAULT generate_cashflow_id();

-- Step 6: Temporarily disable foreign key constraint
ALTER TABLE bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_matched_cashflow_id_fkey;

-- Step 7: Update existing cashflow_records to use progressive IDs
-- Create a temp mapping table
CREATE TEMP TABLE cashflow_id_mapping (
  old_id TEXT,
  new_id TEXT
);

-- Generate mappings
INSERT INTO cashflow_id_mapping (old_id, new_id)
SELECT
  id,
  'CF-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0')
FROM cashflow_records
ORDER BY created_at;

-- Update bank_transactions first
UPDATE bank_transactions bt
SET matched_cashflow_id = m.new_id
FROM cashflow_id_mapping m
WHERE bt.matched_cashflow_id = m.old_id;

-- Update cashflow_records
UPDATE cashflow_records cf
SET id = m.new_id
FROM cashflow_id_mapping m
WHERE cf.id = m.old_id;

-- Step 8: Restore foreign key constraint
ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_matched_cashflow_id_fkey
  FOREIGN KEY (matched_cashflow_id) REFERENCES cashflow_records(id) ON DELETE SET NULL;

-- Step 9: Set sequence to next available number
SELECT setval('cashflow_id_seq', (SELECT COUNT(*) + 1 FROM cashflow_records));
