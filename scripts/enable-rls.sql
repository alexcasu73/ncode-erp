-- ============================================
-- RE-ENABLE ROW LEVEL SECURITY
-- ============================================
-- Re-enables RLS on all tables after authentication is ready
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

-- Check if policies exist
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
