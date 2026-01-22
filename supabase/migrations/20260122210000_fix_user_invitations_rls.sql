-- Fix RLS policy on user_invitations to avoid auth.users permission issues
-- The previous policy tried to access auth.users which causes permission denied errors

BEGIN;

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Company members can view company invitations" ON user_invitations;

-- Create simplified SELECT policy: users can see invitations for their company
CREATE POLICY "Company members can view company invitations"
ON user_invitations
FOR SELECT
USING (
  -- User is a member of the company (can see all company invitations)
  company_id IN (
    SELECT company_id
    FROM company_users
    WHERE user_id = auth.uid()
      AND is_active = true
  )
);

-- Also add INSERT policy for admins (needed for creating invitations)
DROP POLICY IF EXISTS "Admins can create invitations" ON user_invitations;
CREATE POLICY "Admins can create invitations"
ON user_invitations
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id
    FROM company_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'admin'
  )
);

-- Add DELETE policy for admins (needed for deleting pending invitations)
DROP POLICY IF EXISTS "Admins can delete invitations" ON user_invitations;
CREATE POLICY "Admins can delete invitations"
ON user_invitations
FOR DELETE
USING (
  company_id IN (
    SELECT company_id
    FROM company_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'admin'
  )
);

COMMIT;
