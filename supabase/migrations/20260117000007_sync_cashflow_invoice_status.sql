-- ============================================
-- SYNC CASHFLOW AND INVOICE STATUS
-- ============================================
-- When a cashflow record becomes "Effettivo",
-- the related invoice should also become "Effettivo"
-- Created: 2026-01-17
-- ============================================

-- ============================================
-- STEP 1: Create trigger function
-- ============================================

CREATE OR REPLACE FUNCTION sync_invoice_status_from_cashflow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if:
  -- 1. The cashflow record has an associated invoice
  -- 2. The stato_fatturazione is being set to 'Effettivo'
  IF NEW.invoice_id IS NOT NULL AND NEW.stato_fatturazione = 'Effettivo' THEN

    -- Check if the status actually changed (for UPDATE operations)
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.stato_fatturazione IS NULL OR OLD.stato_fatturazione != 'Effettivo')) THEN

      -- Update the related invoice to 'Effettivo'
      UPDATE invoices
      SET
        stato_fatturazione = 'Effettivo',
        updated_at = NOW()
      WHERE id = NEW.invoice_id;

      -- Log the change (optional, for debugging)
      RAISE NOTICE 'Invoice % status updated to Effettivo due to cashflow % becoming Effettivo', NEW.invoice_id, NEW.id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Create trigger on cashflow_records
-- ============================================

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS sync_invoice_status_trigger ON cashflow_records;

-- Create trigger that fires AFTER INSERT or UPDATE
CREATE TRIGGER sync_invoice_status_trigger
  AFTER INSERT OR UPDATE OF stato_fatturazione, invoice_id
  ON cashflow_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_status_from_cashflow();

-- ============================================
-- STEP 3: One-time sync of existing data
-- ============================================

-- Update all invoices that have cashflow records marked as 'Effettivo'
-- but the invoice is still marked as 'Stimato'
UPDATE invoices
SET
  stato_fatturazione = 'Effettivo',
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT invoice_id
  FROM cashflow_records
  WHERE
    invoice_id IS NOT NULL
    AND stato_fatturazione = 'Effettivo'
)
AND stato_fatturazione != 'Effettivo';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- From now on, whenever a cashflow record is marked as 'Effettivo',
-- the related invoice will automatically be updated to 'Effettivo' as well.
-- ============================================
