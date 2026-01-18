-- ============================================
-- MULTI-TENANT MIGRATION
-- ============================================
-- This migration transforms the system into a multi-tenant architecture
-- Created: 2026-01-17
--
-- IMPORTANT: Run this migration in a transaction and test thoroughly
-- Make sure to backup the database before running this migration
-- ============================================

-- ============================================
-- STEP 1: Create Companies Table
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb, -- Company-specific settings
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on slug for faster lookups
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_is_active ON companies(is_active);

-- ============================================
-- STEP 2: Create Users Table (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- STEP 3: Create Company Users Junction Table
-- ============================================
CREATE TABLE IF NOT EXISTS company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Add indexes for faster lookups
CREATE INDEX idx_company_users_company_id ON company_users(company_id);
CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_company_users_role ON company_users(role);

-- ============================================
-- STEP 4: Add company_id to existing tables
-- ============================================

-- Add company_id to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

-- Add company_id to cashflow_records
ALTER TABLE cashflow_records
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cashflow_records_company_id ON cashflow_records(company_id);

-- Add company_id to bank_transactions
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_company_id ON bank_transactions(company_id);

-- Add company_id to reconciliation_sessions
ALTER TABLE reconciliation_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_company_id ON reconciliation_sessions(company_id);

-- Add company_id to deals (if it exists and has data)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);

-- Update settings table to be per-company
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_settings_company_id ON settings(company_id);

-- ============================================
-- STEP 5: Create default company and user
-- ============================================

-- Insert Ncode Studio company
INSERT INTO companies (id, name, slug, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Ncode Studio',
  'ncode-studio',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Note: The user will be created when they first log in with Supabase Auth
-- We'll need to handle the user creation in the application code

-- ============================================
-- STEP 6: Migrate existing data to Ncode Studio
-- ============================================

-- Update all existing invoices to belong to Ncode Studio
UPDATE invoices
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Update all existing cashflow_records to belong to Ncode Studio
UPDATE cashflow_records
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Update all existing bank_transactions to belong to Ncode Studio
UPDATE bank_transactions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Update all existing reconciliation_sessions to belong to Ncode Studio
UPDATE reconciliation_sessions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Update all existing deals to belong to Ncode Studio
UPDATE deals
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Update settings to belong to Ncode Studio
UPDATE settings
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- ============================================
-- STEP 6.5: Update settings table primary key
-- ============================================

-- Make the id column a compound key with company_id
-- First, drop the existing primary key
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- Add new composite primary key
ALTER TABLE settings ADD PRIMARY KEY (id, company_id);

-- ============================================
-- STEP 7: Make company_id NOT NULL
-- ============================================

-- Now that all records have a company_id, make it required
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE cashflow_records ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE bank_transactions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE reconciliation_sessions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE deals ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN company_id SET NOT NULL;

-- ============================================
-- STEP 8: Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 9: Create RLS Policies
-- ============================================

-- Companies: Users can only see companies they belong to
CREATE POLICY "Users can view their companies" ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT
  USING (id = auth.uid());

-- Company Users: Users can view company memberships for their companies
CREATE POLICY "Users can view company memberships" ON company_users
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Invoices: Users can only access invoices from their companies
CREATE POLICY "Users can view company invoices" ON invoices
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company invoices" ON invoices
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company invoices" ON invoices
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company invoices" ON invoices
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Cashflow Records: Same RLS as invoices
CREATE POLICY "Users can view company cashflow records" ON cashflow_records
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company cashflow records" ON cashflow_records
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company cashflow records" ON cashflow_records
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company cashflow records" ON cashflow_records
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Bank Transactions: Same RLS as invoices
CREATE POLICY "Users can view company bank transactions" ON bank_transactions
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company bank transactions" ON bank_transactions
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company bank transactions" ON bank_transactions
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company bank transactions" ON bank_transactions
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Reconciliation Sessions: Same RLS as invoices
CREATE POLICY "Users can view company reconciliation sessions" ON reconciliation_sessions
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company reconciliation sessions" ON reconciliation_sessions
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company reconciliation sessions" ON reconciliation_sessions
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company reconciliation sessions" ON reconciliation_sessions
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Deals: Same RLS as invoices
CREATE POLICY "Users can view company deals" ON deals
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert company deals" ON deals
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update company deals" ON deals
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete company deals" ON deals
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Settings: Same RLS as invoices
CREATE POLICY "Users can view company settings" ON settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can update company settings" ON settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- ============================================
-- STEP 10: Create helper functions
-- ============================================

-- Function to get user's companies
CREATE OR REPLACE FUNCTION get_user_companies(user_uuid UUID)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_slug TEXT,
  user_role TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    cu.role,
    cu.is_active
  FROM companies c
  INNER JOIN company_users cu ON c.id = cu.company_id
  WHERE cu.user_id = user_uuid AND cu.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has admin role in a company
CREATE OR REPLACE FUNCTION is_company_admin(user_uuid UUID, comp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = user_uuid
      AND company_id = comp_id
      AND role = 'admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 11: Create triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to new tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_users_updated_at BEFORE UPDATE ON company_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this migration on the database
-- 2. Create the first admin user in Supabase Auth
-- 3. Link the user to Ncode Studio company with admin role
-- 4. Update the application code to handle authentication
-- 5. Update DataContext to filter by company_id
-- ============================================
