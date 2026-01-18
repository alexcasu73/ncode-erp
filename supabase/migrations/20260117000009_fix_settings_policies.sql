-- ============================================
-- FIX SETTINGS TABLE RLS POLICIES
-- ============================================
-- Remove overly permissive policy and add proper WITH CHECK clauses
-- Created: 2026-01-17
-- ============================================

-- ============================================
-- STEP 1: Remove overly permissive policy
-- ============================================

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON settings;

-- ============================================
-- STEP 2: Recreate UPDATE policy with WITH CHECK
-- ============================================

DROP POLICY IF EXISTS "Admins can update company settings" ON settings;

CREATE POLICY "Admins can update company settings" ON settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- ============================================
-- STEP 3: Add INSERT policy for admins
-- ============================================

DROP POLICY IF EXISTS "Admins can insert company settings" ON settings;

CREATE POLICY "Admins can insert company settings" ON settings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
