-- ============================================
-- CUSTOMERS MULTI-TENANT MIGRATION
-- ============================================
-- Adds multi-tenant support and additional fields to customers table
-- Created: 2026-01-17
-- ============================================

-- ============================================
-- STEP 1: Add company_id to customers table
-- ============================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- ============================================
-- STEP 2: Add additional fields for complete customer info
-- ============================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS pec TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative TEXT;

-- ============================================
-- STEP 3: Migrate existing customers to default company (Ncode Studio)
-- ============================================
UPDATE customers
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- ============================================
-- STEP 4: Make company_id NOT NULL
-- ============================================
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;

-- ============================================
-- STEP 5: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Create RLS Policies
-- ============================================

-- Customers: Users can only access customers from their companies
CREATE POLICY "Users can view company customers" ON customers
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company customers" ON customers
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company customers" ON customers
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company customers" ON customers
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
