-- Debug: Verifica calcolo margine e uscite

-- 1. Totale uscite effettive 2026 (quello che dovrebbe mostrare Fatturazione)
SELECT
    'Uscite Effettive 2026' as descrizione,
    COUNT(*) as num_fatture,
    SUM(flusso) as totale_flusso,
    SUM(iva) as totale_iva,
    SUM(flusso + iva) as totale_con_iva
FROM invoices
WHERE anno = 2026
AND stato_fatturazione = 'Effettivo'
AND tipo = 'Uscita';

-- 2. Totale entrate effettive 2026
SELECT
    'Entrate Effettive 2026' as descrizione,
    COUNT(*) as num_fatture,
    SUM(flusso) as totale_flusso,
    SUM(iva) as totale_iva,
    SUM(flusso + iva) as totale_con_iva
FROM invoices
WHERE anno = 2026
AND stato_fatturazione = 'Effettivo'
AND tipo = 'Entrata';

-- 3. Margine (Entrate - Uscite) per Panoramica
SELECT
    'Margine Effettivo 2026' as descrizione,
    (SELECT COALESCE(SUM(flusso), 0) FROM invoices WHERE anno = 2026 AND stato_fatturazione = 'Effettivo' AND tipo = 'Entrata') as entrate,
    (SELECT COALESCE(SUM(flusso), 0) FROM invoices WHERE anno = 2026 AND stato_fatturazione = 'Effettivo' AND tipo = 'Uscita') as uscite,
    (SELECT COALESCE(SUM(flusso), 0) FROM invoices WHERE anno = 2026 AND stato_fatturazione = 'Effettivo' AND tipo = 'Entrata') -
    (SELECT COALESCE(SUM(flusso), 0) FROM invoices WHERE anno = 2026 AND stato_fatturazione = 'Effettivo' AND tipo = 'Uscita') as margine;

-- 4. Dettaglio per mese (per capire se c'è un filtro mese attivo)
SELECT
    mese,
    COUNT(*) as num_fatture,
    SUM(flusso) as totale_flusso
FROM invoices
WHERE anno = 2026
AND stato_fatturazione = 'Effettivo'
AND tipo = 'Uscita'
GROUP BY mese
ORDER BY
    CASE mese
        WHEN 'Gennaio' THEN 1
        WHEN 'Febbraio' THEN 2
        WHEN 'Marzo' THEN 3
        WHEN 'Aprile' THEN 4
        WHEN 'Maggio' THEN 5
        WHEN 'Giugno' THEN 6
        WHEN 'Luglio' THEN 7
        WHEN 'Agosto' THEN 8
        WHEN 'Settembre' THEN 9
        WHEN 'Ottobre' THEN 10
        WHEN 'Novembre' THEN 11
        WHEN 'Dicembre' THEN 12
    END;
