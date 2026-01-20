-- ============================================
-- FIX cleanup_orphaned_companies FUNCTION
-- ============================================
-- Remove invoice_notifications delete (no company_id column)
-- CASCADE from invoices deletion will handle it automatically
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_companies()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_remaining_users INTEGER;
BEGIN
  -- Get the company_id from the deleted record
  v_company_id := OLD.company_id;

  -- Check if there are any remaining active users in the company
  SELECT COUNT(*) INTO v_remaining_users
  FROM company_users
  WHERE company_id = v_company_id
    AND is_active = true;

  -- If no users left, delete all company data
  IF v_remaining_users = 0 THEN
    RAISE NOTICE 'No users left in company %, deleting all company data', v_company_id;

    -- Delete in order to respect foreign key constraints
    -- invoice_notifications will be deleted via CASCADE from invoices
    DELETE FROM reconciliation_sessions WHERE company_id = v_company_id;
    DELETE FROM bank_transactions WHERE company_id = v_company_id;
    DELETE FROM cashflow_records WHERE company_id = v_company_id;
    DELETE FROM invoices WHERE company_id = v_company_id;
    DELETE FROM deals WHERE company_id = v_company_id;
    DELETE FROM customers WHERE company_id = v_company_id;
    DELETE FROM financial_items WHERE company_id = v_company_id;
    DELETE FROM bank_balances WHERE company_id = v_company_id;
    DELETE FROM settings WHERE company_id = v_company_id;
    DELETE FROM companies WHERE id = v_company_id;

    RAISE NOTICE 'Company % and all related data deleted', v_company_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_orphaned_companies() IS
  'Automatically deletes all company data when the last user is removed from a company.
  Fixed to remove invoice_notifications line (handled by CASCADE).';
