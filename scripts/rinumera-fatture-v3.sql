-- ============================================
-- RINUMERAZIONE FATTURE CON NUMERI PROGRESSIVI
-- ============================================
-- IMPORTANTE: Mantiene tutte le relazioni con cashflow_records,
-- bank_transactions e invoice_notifications
-- ============================================

BEGIN;

-- Crea tabella temporanea per mappatura vecchio -> nuovo ID
CREATE TEMP TABLE invoice_id_mapping (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL,
  anno INTEGER NOT NULL
);

-- Popola la mappatura con nuovi ID progressivi per anno
DO $$
DECLARE
  invoice_record RECORD;
  progressivo INTEGER;
  current_year INTEGER;
  last_year INTEGER := -1;
  new_invoice_id TEXT;
BEGIN
  RAISE NOTICE '🔄 Inizio rinumerazione fatture...';

  -- Ordina le fatture per anno e data di creazione
  FOR invoice_record IN
    SELECT id, anno, created_at
    FROM invoices
    WHERE company_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY anno, created_at
  LOOP
    current_year := invoice_record.anno;

    -- Reset progressivo quando cambia anno
    IF current_year != last_year THEN
      progressivo := 0;
      last_year := current_year;
      RAISE NOTICE '📅 Anno %: inizia numerazione', current_year;
    END IF;

    progressivo := progressivo + 1;
    new_invoice_id := 'Fattura_' || progressivo || '/' || current_year;

    -- Inserisci mappatura
    INSERT INTO invoice_id_mapping (old_id, new_id, anno)
    VALUES (invoice_record.id, new_invoice_id, current_year);

    IF progressivo <= 5 OR progressivo % 50 = 0 THEN
      RAISE NOTICE '  ✓ %: % -> %', progressivo,
        SUBSTRING(invoice_record.id, 1, 30), new_invoice_id;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Mappatura completata: % fatture', (SELECT COUNT(*) FROM invoice_id_mapping);
END $$;

-- Verifica mappatura
DO $$
DECLARE
  mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM invoice_id_mapping;
  RAISE NOTICE '📊 Mappature create: %', mapping_count;
END $$;

-- STEP 1: Elimina i constraint PRIMA di qualsiasi update
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔓 Rimozione constraint temporanea...';

  ALTER TABLE cashflow_records DROP CONSTRAINT IF EXISTS cashflow_records_invoice_id_fkey;
  ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_matched_invoice_id_fkey;
  ALTER TABLE invoice_notifications DROP CONSTRAINT IF EXISTS invoice_notifications_invoice_id_fkey;

  RAISE NOTICE '  ✓ Constraint rimossi';
END $$;

-- STEP 2: Aggiorna tutte le relazioni (ora senza constraint)
DO $$
DECLARE
  count_cashflow INTEGER;
  count_transactions INTEGER;
  count_notifications INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Aggiornamento relazioni...';

  -- 1. Aggiorna cashflow_records.invoice_id
  UPDATE cashflow_records cr
  SET invoice_id = m.new_id
  FROM invoice_id_mapping m
  WHERE cr.invoice_id = m.old_id;

  GET DIAGNOSTICS count_cashflow = ROW_COUNT;
  RAISE NOTICE '  ✓ Cashflow aggiornati: %', count_cashflow;

  -- 2. Aggiorna bank_transactions.matched_invoice_id
  UPDATE bank_transactions bt
  SET matched_invoice_id = m.new_id
  FROM invoice_id_mapping m
  WHERE bt.matched_invoice_id = m.old_id;

  GET DIAGNOSTICS count_transactions = ROW_COUNT;
  RAISE NOTICE '  ✓ Bank transactions aggiornate: %', count_transactions;

  -- 3. Aggiorna invoice_notifications.invoice_id
  UPDATE invoice_notifications notif
  SET invoice_id = m.new_id
  FROM invoice_id_mapping m
  WHERE notif.invoice_id = m.old_id;

  GET DIAGNOSTICS count_notifications = ROW_COUNT;
  RAISE NOTICE '  ✓ Notifiche aggiornate: %', count_notifications;
END $$;

-- STEP 3: Aggiorna gli ID delle fatture usando DELETE + INSERT
DO $$
DECLARE
  deleted_count INTEGER;
  inserted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📄 Aggiornamento ID fatture...';

  -- Crea nuova tabella con nuovi ID
  CREATE TEMP TABLE invoices_new AS
  SELECT
    COALESCE(m.new_id, i.id) as id,
    i.data,
    i.mese,
    i.anno,
    i.nome_progetto,
    i.tipo,
    i.stato_fatturazione,
    i.spesa,
    i.tipo_spesa,
    i.note,
    i.flusso,
    i.iva,
    i.percentuale_iva,
    i.percentuale_fatturazione,
    i.checked,
    i.created_at,
    i.updated_at,
    i.data_scadenza,
    i.company_id
  FROM invoices i
  LEFT JOIN invoice_id_mapping m ON i.id = m.old_id
  WHERE i.company_id = '00000000-0000-0000-0000-000000000001';

  -- Elimina vecchie fatture
  DELETE FROM invoices WHERE company_id = '00000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Fatture vecchie eliminate: %', deleted_count;

  -- Inserisci fatture rinumerate
  INSERT INTO invoices SELECT * FROM invoices_new;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Fatture nuove inserite: %', inserted_count;
END $$;

-- STEP 4: Ricrea i constraint
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Ricreazione constraint...';

  ALTER TABLE cashflow_records
    ADD CONSTRAINT cashflow_records_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

  ALTER TABLE bank_transactions
    ADD CONSTRAINT bank_transactions_matched_invoice_id_fkey
    FOREIGN KEY (matched_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

  ALTER TABLE invoice_notifications
    ADD CONSTRAINT invoice_notifications_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

  RAISE NOTICE '  ✓ Constraint ricreati';
END $$;

-- STEP 5: Verifica integrità
DO $$
DECLARE
  orphan_cashflow INTEGER;
  orphan_transactions INTEGER;
  orphan_notifications INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verifica integrità...';

  -- Verifica cashflow orfani
  SELECT COUNT(*) INTO orphan_cashflow
  FROM cashflow_records cr
  WHERE cr.invoice_id IS NOT NULL
    AND cr.company_id = '00000000-0000-0000-0000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = cr.invoice_id);

  -- Verifica bank transactions orfane
  SELECT COUNT(*) INTO orphan_transactions
  FROM bank_transactions bt
  WHERE bt.matched_invoice_id IS NOT NULL
    AND bt.company_id = '00000000-0000-0000-0000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = bt.matched_invoice_id);

  -- Verifica notifiche orfane
  SELECT COUNT(*) INTO orphan_notifications
  FROM invoice_notifications notif
  WHERE notif.invoice_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = (SELECT id FROM invoices WHERE company_id = '00000000-0000-0000-0000-000000000001' LIMIT 1)
    )
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = notif.invoice_id);

  IF orphan_cashflow > 0 THEN
    RAISE EXCEPTION '❌ ERRORE: % cashflow orfani trovati!', orphan_cashflow;
  END IF;

  IF orphan_transactions > 0 THEN
    RAISE EXCEPTION '❌ ERRORE: % bank transactions orfane trovate!', orphan_transactions;
  END IF;

  IF orphan_notifications > 0 THEN
    RAISE EXCEPTION '❌ ERRORE: % notifiche orfane trovate!', orphan_notifications;
  END IF;

  RAISE NOTICE '  ✓ Nessun record orfano';
  RAISE NOTICE '  ✓ Tutte le relazioni sono integre!';
END $$;

-- STEP 6: Riepilogo finale
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 RIEPILOGO FINALE:';
END $$;

SELECT
  anno,
  COUNT(*) as fatture_per_anno,
  MIN(SUBSTRING(id FROM 9 FOR POSITION('/' IN SUBSTRING(id FROM 9)) - 1)::INTEGER) as da_numero,
  MAX(SUBSTRING(id FROM 9 FOR POSITION('/' IN SUBSTRING(id FROM 9)) - 1)::INTEGER) as a_numero
FROM invoices
WHERE company_id = '00000000-0000-0000-0000-000000000001'
GROUP BY anno
ORDER BY anno DESC;

-- Contatori finali
SELECT
  (SELECT COUNT(*) FROM invoices WHERE company_id = '00000000-0000-0000-0000-000000000001') as fatture_totali,
  (SELECT COUNT(*) FROM cashflow_records WHERE invoice_id IS NOT NULL AND company_id = '00000000-0000-0000-0000-000000000001') as cashflow_collegati,
  (SELECT COUNT(*) FROM bank_transactions WHERE matched_invoice_id IS NOT NULL AND company_id = '00000000-0000-0000-0000-000000000001') as transactions_collegate,
  (SELECT COUNT(*) FROM invoice_notifications WHERE invoice_id IS NOT NULL) as notifiche_collegate;

-- Esempi fatture rinumerate
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 Esempi fatture rinumerate (ultime 10):';
END $$;

SELECT id, anno, data, tipo, stato_fatturazione
FROM invoices
WHERE company_id = '00000000-0000-0000-0000-000000000001'
ORDER BY anno DESC, SUBSTRING(id FROM 9 FOR POSITION('/' IN SUBSTRING(id FROM 9)) - 1)::INTEGER DESC
LIMIT 10;

COMMIT;

-- Messaggio finale
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ COMPLETATO! Tutte le relazioni sono state preservate.';
  RAISE NOTICE '✅ Fatture rinumerate con successo!';
END $$;
