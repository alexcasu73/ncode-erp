-- ============================================
-- FIX: RLS Policy for Login
-- ============================================
-- The company_users policy is blocking login
-- Need to allow authenticated users to read their own records
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;

-- Create simpler policy that works during login
-- Users can see their own company_users records if authenticated
CREATE POLICY "Users can view their company memberships" ON company_users
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Also ensure settings table allows reads for authenticated users
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON settings;

CREATE POLICY "Enable all operations for authenticated users" ON settings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verify policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('company_users', 'settings')
ORDER BY tablename, policyname;
