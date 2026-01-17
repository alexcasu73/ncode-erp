-- ============================================
-- FIX: Missing RLS Policies
-- ============================================
-- Some tables have RLS enabled but no policies
-- This blocks all access. We need to either:
-- 1. Disable RLS on tables without company_id
-- 2. Add permissive policies
-- ============================================

-- Disable RLS on tables that don't have company_id (legacy tables)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_balances DISABLE ROW LEVEL SECURITY;

-- Verify RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'transactions', 'financial_items', 'bank_balances')
ORDER BY tablename;

-- Check all tables with RLS enabled have policies
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as num_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename, t.rowsecurity
HAVING COUNT(p.policyname) = 0
ORDER BY t.tablename;
