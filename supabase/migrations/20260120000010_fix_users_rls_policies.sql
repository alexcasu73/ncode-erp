-- Fix RLS policies on users table to allow company members to see each other
-- Issue: Users can only see their own profile, causing "Unknown" in user lists

BEGIN;

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Create new SELECT policy: users can see all members of their company
CREATE POLICY "Users can view company members"
ON users
FOR SELECT
USING (
  -- User can see themselves
  id = auth.uid()
  OR
  -- OR user can see other members of the same company
  EXISTS (
    SELECT 1 FROM company_users cu1
    WHERE cu1.user_id = auth.uid()
      AND cu1.is_active = true
      AND EXISTS (
        SELECT 1 FROM company_users cu2
        WHERE cu2.user_id = users.id
          AND cu2.company_id = cu1.company_id
      )
  )
);

COMMIT;
