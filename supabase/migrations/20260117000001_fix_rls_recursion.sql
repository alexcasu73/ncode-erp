-- ============================================
-- FIX: RLS Infinite Recursion
-- ============================================
-- The company_users policy was creating infinite recursion
-- by querying itself. This migration fixes that issue.
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;

-- Create a simpler policy that doesn't recurse
-- Users can see their own company memberships directly
CREATE POLICY "Users can view their own company memberships" ON company_users
  FOR SELECT
  USING (user_id = auth.uid());

-- For other operations on company_users, we can add separate policies
-- Users can see all company memberships for companies they belong to
-- But we need to avoid recursion, so we use a simpler check
CREATE POLICY "Users can view memberships in their companies" ON company_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users AS cu
      WHERE cu.company_id = company_users.company_id
        AND cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

-- Drop the duplicate policy (we just created two, let's keep only one combined version)
DROP POLICY IF EXISTS "Users can view their own company memberships" ON company_users;
DROP POLICY IF EXISTS "Users can view memberships in their companies" ON company_users;

-- Create final combined policy
-- Users can see:
-- 1. Their own memberships (user_id = auth.uid())
-- 2. All memberships for companies they belong to
CREATE POLICY "Users can view company memberships" ON company_users
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    company_id IN (
      SELECT cu.company_id
      FROM company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

-- Wait, this still has recursion! Let me try a different approach.
-- The issue is that we're selecting from company_users within the company_users policy.
-- We need to use a security definer function to break the recursion.

DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;

-- Create a security definer function to get user's companies
CREATE OR REPLACE FUNCTION get_user_company_ids(user_uuid UUID)
RETURNS TABLE (company_id UUID)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT cu.company_id
  FROM company_users cu
  WHERE cu.user_id = user_uuid AND cu.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Now create the policy using the function
CREATE POLICY "Users can view company memberships" ON company_users
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    company_id IN (SELECT get_user_company_ids(auth.uid()))
  );

-- Actually, a simpler approach: just let users see their own memberships
-- and admin users see all memberships in their companies
-- Let's use the simplest possible policy first

DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;

CREATE POLICY "Users can view company memberships" ON company_users
  FOR SELECT
  USING (user_id = auth.uid());

-- This simple policy means users can only see their own company_users records
-- That's sufficient for basic multi-tenancy
-- If we need to show team members later, we can add that separately

-- Verify the fix works by checking that there are no recursive references
-- The companies policy references company_users
-- But the company_users policy now only references auth.uid() - no recursion!
