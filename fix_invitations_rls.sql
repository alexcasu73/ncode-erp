-- Fix RLS policy on user_invitations to allow company admins to see all invitations
-- This allows admins to see pending invitations in the user management page

BEGIN;

-- Drop any existing SELECT policies on user_invitations
DROP POLICY IF EXISTS "Users can view invitations by email" ON user_invitations;
DROP POLICY IF EXISTS "Company members can view company invitations" ON user_invitations;

-- Create new SELECT policy: users can see invitations for their company
CREATE POLICY "Company members can view company invitations"
ON user_invitations
FOR SELECT
USING (
  -- User can see invitations sent to their email
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR
  -- OR user is a completed invitee
  user_id = auth.uid()
  OR
  -- OR user is a member of the company (can see all company invitations)
  company_id IN (
    SELECT company_id
    FROM company_users
    WHERE user_id = auth.uid()
      AND is_active = true
  )
);

COMMIT;
