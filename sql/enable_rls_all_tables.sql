-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================================
-- This script enables RLS and creates policies to ensure multi-tenant isolation
-- Each company can only access their own data
-- ============================================================================

-- Function to get current user's company_id
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID AS $$
  SELECT company_id
  FROM company_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION auth.user_company_id() TO authenticated;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core business tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Customer and deals
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Financial tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Notification table (already enabled)
-- ALTER TABLE invoice_notifications ENABLE ROW LEVEL SECURITY;

-- Team and objectives (if used)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE objective_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE POLICIES - STANDARD COMPANY ISOLATION
-- ============================================================================

-- Template policy for tables with company_id column:
-- Users can only access data from their own company

-- COMPANIES table
DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can update own company" ON companies;
CREATE POLICY "Users can update own company"
  ON companies FOR UPDATE
  USING (id = auth.user_company_id());

-- USERS table (special: users can see users in their company)
DROP POLICY IF EXISTS "Users can view company users" ON users;
CREATE POLICY "Users can view company users"
  ON users FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- COMPANY_USERS table
DROP POLICY IF EXISTS "Users can view company members" ON company_users;
CREATE POLICY "Users can view company members"
  ON company_users FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Admins can manage company members" ON company_users;
CREATE POLICY "Admins can manage company members"
  ON company_users FOR ALL
  USING (
    company_id = auth.user_company_id() AND
    EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid()
        AND company_id = auth.user_company_id()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- SETTINGS table
DROP POLICY IF EXISTS "Users can view company settings" ON settings;
CREATE POLICY "Users can view company settings"
  ON settings FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Admins can update company settings" ON settings;
CREATE POLICY "Admins can update company settings"
  ON settings FOR ALL
  USING (
    company_id = auth.user_company_id() AND
    EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid()
        AND company_id = auth.user_company_id()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- CUSTOMERS table
DROP POLICY IF EXISTS "Users can view company customers" ON customers;
CREATE POLICY "Users can view company customers"
  ON customers FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company customers" ON customers;
CREATE POLICY "Users can manage company customers"
  ON customers FOR ALL
  USING (company_id = auth.user_company_id());

-- DEALS table
DROP POLICY IF EXISTS "Users can view company deals" ON deals;
CREATE POLICY "Users can view company deals"
  ON deals FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company deals" ON deals;
CREATE POLICY "Users can manage company deals"
  ON deals FOR ALL
  USING (company_id = auth.user_company_id());

-- INVOICES table
DROP POLICY IF EXISTS "Users can view company invoices" ON invoices;
CREATE POLICY "Users can view company invoices"
  ON invoices FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company invoices" ON invoices;
CREATE POLICY "Users can manage company invoices"
  ON invoices FOR ALL
  USING (company_id = auth.user_company_id());

-- CASHFLOW_RECORDS table
DROP POLICY IF EXISTS "Users can view company cashflow" ON cashflow_records;
CREATE POLICY "Users can view company cashflow"
  ON cashflow_records FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company cashflow" ON cashflow_records;
CREATE POLICY "Users can manage company cashflow"
  ON cashflow_records FOR ALL
  USING (company_id = auth.user_company_id());

-- BANK_BALANCES table
DROP POLICY IF EXISTS "Users can view company bank balances" ON bank_balances;
CREATE POLICY "Users can view company bank balances"
  ON bank_balances FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company bank balances" ON bank_balances;
CREATE POLICY "Users can manage company bank balances"
  ON bank_balances FOR ALL
  USING (company_id = auth.user_company_id());

-- BANK_TRANSACTIONS table
DROP POLICY IF EXISTS "Users can view company bank transactions" ON bank_transactions;
CREATE POLICY "Users can view company bank transactions"
  ON bank_transactions FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company bank transactions" ON bank_transactions;
CREATE POLICY "Users can manage company bank transactions"
  ON bank_transactions FOR ALL
  USING (company_id = auth.user_company_id());

-- FINANCIAL_ITEMS table
DROP POLICY IF EXISTS "Users can view company financial items" ON financial_items;
CREATE POLICY "Users can view company financial items"
  ON financial_items FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company financial items" ON financial_items;
CREATE POLICY "Users can manage company financial items"
  ON financial_items FOR ALL
  USING (company_id = auth.user_company_id());

-- RECONCILIATION_SESSIONS table
DROP POLICY IF EXISTS "Users can view company reconciliation sessions" ON reconciliation_sessions;
CREATE POLICY "Users can view company reconciliation sessions"
  ON reconciliation_sessions FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company reconciliation sessions" ON reconciliation_sessions;
CREATE POLICY "Users can manage company reconciliation sessions"
  ON reconciliation_sessions FOR ALL
  USING (company_id = auth.user_company_id());

-- TRANSACTIONS table
DROP POLICY IF EXISTS "Users can view company transactions" ON transactions;
CREATE POLICY "Users can view company transactions"
  ON transactions FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company transactions" ON transactions;
CREATE POLICY "Users can manage company transactions"
  ON transactions FOR ALL
  USING (company_id = auth.user_company_id());

-- INVOICE_NOTIFICATIONS table (already has RLS)
DROP POLICY IF EXISTS "Users can view company notifications" ON invoice_notifications;
CREATE POLICY "Users can view company notifications"
  ON invoice_notifications FOR SELECT
  USING (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "Users can manage company notifications" ON invoice_notifications;
CREATE POLICY "Users can manage company notifications"
  ON invoice_notifications FOR ALL
  USING (company_id = auth.user_company_id());

-- ============================================================================
-- OPTIONAL: Team tables (if used)
-- ============================================================================

-- TEAMS table
DROP POLICY IF EXISTS "Users can view company teams" ON teams;
CREATE POLICY "Users can view company teams"
  ON teams FOR SELECT
  USING (company_id = auth.user_company_id());

-- TEAM_MEMBERS table
DROP POLICY IF EXISTS "Users can view company team members" ON team_members;
CREATE POLICY "Users can view company team members"
  ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE company_id = auth.user_company_id()
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rls_status, tablename;

-- Check policies created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test 1: Verify user can only see their own company's data
-- Run as authenticated user:
-- SELECT * FROM invoices; -- Should only show invoices from your company

-- Test 2: Verify user cannot access other company's data
-- Try to query with explicit company_id of another company:
-- SELECT * FROM invoices WHERE company_id = 'other-company-uuid';
-- Should return 0 rows even if data exists

-- Test 3: Verify admin-only operations
-- As non-admin user, try:
-- DELETE FROM company_users WHERE user_id = 'some-user-id';
-- Should fail with permission denied

COMMENT ON FUNCTION auth.user_company_id() IS
  'Returns the company_id for the currently authenticated user. Used in RLS policies.';
