-- Debug: Verifica transazioni da 20€

-- 1. Tutte le transazioni da 20€
SELECT
    'Transazioni Bancarie 20€' as tipo,
    bt.id,
    bt.data,
    bt.importo,
    bt.descrizione,
    bt.match_status,
    bt.matched_cashflow_id,
    bt.match_confidence
FROM bank_transactions bt
WHERE ABS(bt.importo - 20.00) < 0.01
ORDER BY bt.data;

-- 2. Tutti i flussi di cassa da 20€
SELECT
    'Flussi di Cassa 20€' as tipo,
    cf.id,
    cf.data_pagamento,
    cf.importo,
    cf.note,
    cf.categoria,
    i.spesa as invoice_spesa,
    i.tipo_spesa as invoice_tipo_spesa,
    i.note as invoice_note
FROM cashflow_records cf
LEFT JOIN invoices i ON cf.invoice_id = i.id
WHERE ABS(cf.importo - 20.00) < 0.01
ORDER BY cf.data_pagamento;

-- 3. Verifica duplicati: flussi abbinati a più transazioni
SELECT
    cf.id as cashflow_id,
    cf.importo,
    cf.note,
    COUNT(bt.id) as num_transazioni_abbinate,
    STRING_AGG(bt.descrizione, ' | ') as transazioni_descrizioni
FROM cashflow_records cf
JOIN bank_transactions bt ON bt.matched_cashflow_id = cf.id AND bt.match_status = 'matched'
WHERE ABS(cf.importo - 20.00) < 0.01
GROUP BY cf.id, cf.importo, cf.note
HAVING COUNT(bt.id) > 1;

-- 4. Riepilogo abbinamenti
SELECT
    (SELECT COUNT(*) FROM bank_transactions WHERE ABS(importo - 20.00) < 0.01) as transazioni_totali,
    (SELECT COUNT(*) FROM cashflow_records WHERE ABS(importo - 20.00) < 0.01) as cashflow_totali,
    (SELECT COUNT(*) FROM bank_transactions WHERE ABS(importo - 20.00) < 0.01 AND match_status = 'matched') as transazioni_abbinate;
