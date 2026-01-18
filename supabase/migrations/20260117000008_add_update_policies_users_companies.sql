-- ============================================
-- ADD UPDATE POLICIES FOR USERS AND COMPANIES
-- ============================================
-- Allows users to update their own profile and admins to update company info
-- Created: 2026-01-17
-- ============================================

-- ============================================
-- STEP 1: Add UPDATE policy for users table
-- ============================================

-- Allow users to update their own profile (full_name, avatar_url)
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- STEP 2: Add UPDATE policy for companies table
-- ============================================

-- Allow admins to update their company information
DROP POLICY IF EXISTS "Admins can update company info" ON companies;

CREATE POLICY "Admins can update company info" ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
