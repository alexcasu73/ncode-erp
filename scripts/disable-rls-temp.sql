-- ============================================
-- TEMPORARY: Disable RLS for Development
-- ============================================
-- This is a TEMPORARY measure to allow data access
-- while implementing authentication.
--
-- ⚠️  RE-ENABLE RLS AFTER AUTHENTICATION IS READY!
-- ============================================

-- Disable RLS on all tables
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Verification
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'users', 'company_users', 'invoices', 'cashflow_records',
                    'bank_transactions', 'reconciliation_sessions', 'deals', 'settings')
ORDER BY tablename;
