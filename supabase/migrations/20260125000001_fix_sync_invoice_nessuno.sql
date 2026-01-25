-- ============================================
-- FIX SYNC CASHFLOW AND INVOICE STATUS
-- ============================================
-- When a cashflow record becomes "Effettivo",
-- the related invoice should become "Effettivo"
-- ONLY if the invoice is in "Stimato" state.
-- If the invoice is in "Nessuno" state, it should remain "Nessuno".
-- Updated: 2026-01-25
-- ============================================

-- ============================================
-- Update trigger function
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
      -- BUT ONLY if the invoice is currently in 'Stimato' state
      -- If the invoice is in 'Nessuno' state, leave it as is
      UPDATE invoices
      SET
        stato_fatturazione = 'Effettivo',
        updated_at = NOW()
      WHERE id = NEW.invoice_id
        AND stato_fatturazione = 'Stimato';  -- Only update if invoice is 'Stimato'

      -- Log the change (optional, for debugging)
      IF FOUND THEN
        RAISE NOTICE 'Invoice % status updated to Effettivo due to cashflow % becoming Effettivo', NEW.invoice_id, NEW.id;
      ELSE
        RAISE NOTICE 'Invoice % status NOT updated (current status is not Stimato)', NEW.invoice_id;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- From now on, when a cashflow record is marked as 'Effettivo':
-- - If the invoice is in 'Stimato' state → it becomes 'Effettivo'
-- - If the invoice is in 'Nessuno' state → it remains 'Nessuno'
-- ============================================
