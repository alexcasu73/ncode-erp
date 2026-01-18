-- ============================================
-- COMPLETE RLS POLICIES FOR ALL TABLES
-- ============================================
-- Adds RLS and policies to tables that are missing them
-- Created: 2026-01-17
-- ============================================

-- ============================================
-- STEP 1: Enable RLS on remaining tables
-- ============================================
ALTER TABLE bank_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Add company_id to remaining tables
-- ============================================

-- Add company_id to bank_balances
ALTER TABLE bank_balances
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bank_balances_company_id ON bank_balances(company_id);

-- Update existing records
UPDATE bank_balances
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Make it required
ALTER TABLE bank_balances ALTER COLUMN company_id SET NOT NULL;

-- Add company_id to financial_items
ALTER TABLE financial_items
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_financial_items_company_id ON financial_items(company_id);

-- Update existing records
UPDATE financial_items
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Make it required
ALTER TABLE financial_items ALTER COLUMN company_id SET NOT NULL;

-- Add company_id to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);

-- Update existing records
UPDATE transactions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Make it required
ALTER TABLE transactions ALTER COLUMN company_id SET NOT NULL;

-- ============================================
-- STEP 3: Create RLS Policies for bank_balances
-- ============================================

DROP POLICY IF EXISTS "Users can view company bank balances" ON bank_balances;
DROP POLICY IF EXISTS "Users can insert company bank balances" ON bank_balances;
DROP POLICY IF EXISTS "Users can update company bank balances" ON bank_balances;
DROP POLICY IF EXISTS "Users can delete company bank balances" ON bank_balances;

CREATE POLICY "Users can view company bank balances" ON bank_balances
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company bank balances" ON bank_balances
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company bank balances" ON bank_balances
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company bank balances" ON bank_balances
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- STEP 4: Create RLS Policies for financial_items
-- ============================================

DROP POLICY IF EXISTS "Users can view company financial items" ON financial_items;
DROP POLICY IF EXISTS "Users can insert company financial items" ON financial_items;
DROP POLICY IF EXISTS "Users can update company financial items" ON financial_items;
DROP POLICY IF EXISTS "Users can delete company financial items" ON financial_items;

CREATE POLICY "Users can view company financial items" ON financial_items
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company financial items" ON financial_items
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company financial items" ON financial_items
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company financial items" ON financial_items
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- STEP 5: Create RLS Policies for transactions
-- ============================================

DROP POLICY IF EXISTS "Users can view company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete company transactions" ON transactions;

CREATE POLICY "Users can view company transactions" ON transactions
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company transactions" ON transactions
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company transactions" ON transactions
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company transactions" ON transactions
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- STEP 6: Add RLS policies for invoice_notifications
-- ============================================

DROP POLICY IF EXISTS "Users can view company invoice notifications" ON invoice_notifications;
DROP POLICY IF EXISTS "Users can insert company invoice notifications" ON invoice_notifications;
DROP POLICY IF EXISTS "Users can update company invoice notifications" ON invoice_notifications;
DROP POLICY IF EXISTS "Users can delete company invoice notifications" ON invoice_notifications;

CREATE POLICY "Users can view company invoice notifications" ON invoice_notifications
  FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "Users can insert company invoice notifications" ON invoice_notifications
  FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "Users can update company invoice notifications" ON invoice_notifications
  FOR UPDATE
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "Users can delete company invoice notifications" ON invoice_notifications
  FOR DELETE
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
