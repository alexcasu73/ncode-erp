-- Fix RLS policies for bank_transactions and reconciliation_sessions
-- Problem: Policies had WITH CHECK but missing USING clauses, causing 403 Forbidden errors

-- ===== BANK TRANSACTIONS POLICIES =====

-- Fix SELECT policy - add USING clause
DROP POLICY IF EXISTS "Users can view company bank transactions" ON bank_transactions;
CREATE POLICY "Users can view company bank transactions"
ON bank_transactions
FOR SELECT
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));

-- Fix UPDATE policy - add USING clause
DROP POLICY IF EXISTS "Users can update company bank transactions" ON bank_transactions;
CREATE POLICY "Users can update company bank transactions"
ON bank_transactions
FOR UPDATE
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
))
WITH CHECK (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));

-- Fix DELETE policy - add USING clause
DROP POLICY IF EXISTS "Users can delete company bank transactions" ON bank_transactions;
CREATE POLICY "Users can delete company bank transactions"
ON bank_transactions
FOR DELETE
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));

-- ===== RECONCILIATION SESSIONS POLICIES =====

-- Fix SELECT policy - add USING clause
DROP POLICY IF EXISTS "Users can view company reconciliation sessions" ON reconciliation_sessions;
CREATE POLICY "Users can view company reconciliation sessions"
ON reconciliation_sessions
FOR SELECT
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));

-- Fix UPDATE policy - add USING clause
DROP POLICY IF EXISTS "Users can update company reconciliation sessions" ON reconciliation_sessions;
CREATE POLICY "Users can update company reconciliation sessions"
ON reconciliation_sessions
FOR UPDATE
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
))
WITH CHECK (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));

-- Fix DELETE policy - add USING clause
DROP POLICY IF EXISTS "Users can delete company reconciliation sessions" ON reconciliation_sessions;
CREATE POLICY "Users can delete company reconciliation sessions"
ON reconciliation_sessions
FOR DELETE
TO public
USING (company_id IN (
  SELECT company_id FROM company_users
  WHERE user_id = auth.uid() AND is_active = true
));
