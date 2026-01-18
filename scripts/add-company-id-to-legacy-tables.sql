-- ============================================
-- ADD COMPANY_ID TO LEGACY TABLES
-- ============================================
-- These tables were created before multi-tenant
-- and don't have company_id column
-- ============================================

-- 1. Add company_id to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Set all existing customers to Ncode Studio (original company)
UPDATE customers
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Make it NOT NULL after setting values
ALTER TABLE customers
ALTER COLUMN company_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- 2. Add company_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE transactions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE transactions
ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);

-- 3. Add company_id to financial_items table
ALTER TABLE financial_items
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE financial_items
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE financial_items
ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_items_company_id ON financial_items(company_id);

-- 4. Add company_id to bank_balances table
ALTER TABLE bank_balances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE bank_balances
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE bank_balances
ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_balances_company_id ON bank_balances(company_id);

-- Drop the old unique constraint on anno (year) since now it should be unique per company
ALTER TABLE bank_balances DROP CONSTRAINT IF EXISTS bank_balances_anno_key;

-- Add new unique constraint for (company_id, anno)
ALTER TABLE bank_balances
ADD CONSTRAINT bank_balances_company_anno_key UNIQUE (company_id, anno);

-- Verify the changes
SELECT
  'customers' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT company_id) as companies
FROM customers
UNION ALL
SELECT
  'transactions',
  COUNT(*),
  COUNT(DISTINCT company_id)
FROM transactions
UNION ALL
SELECT
  'financial_items',
  COUNT(*),
  COUNT(DISTINCT company_id)
FROM financial_items
UNION ALL
SELECT
  'bank_balances',
  COUNT(*),
  COUNT(DISTINCT company_id)
FROM bank_balances;
