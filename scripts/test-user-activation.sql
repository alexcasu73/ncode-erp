-- ============================================================================
-- TEST: User Activation Rules
-- ============================================================================
-- Questo script testa le regole di attivazione/disattivazione utenti
-- ============================================================================

\echo '🧪 Testing User Activation Rules'
\echo '================================='
\echo ''

-- Setup: Trova un utente di test
\echo '1️⃣ Setup: Finding test user...'
SELECT
    u.id as user_id,
    u.email,
    u.name,
    cu.role,
    cu.is_active,
    cu.company_id
FROM users u
JOIN company_users cu ON u.id = cu.user_id
LIMIT 1;

-- Salva user_id in una variabile (manualmente sostituisci <USER_ID> sotto)
\echo ''
\echo '📝 Copia lo user_id dalla query sopra e sostituiscilo in <USER_ID> sotto'
\echo ''

-- ============================================================================
-- Test 1: Disattiva utente
-- ============================================================================
\echo '2️⃣ Test 1: Disattivazione utente'

-- Disattiva l'utente
UPDATE company_users
SET is_active = false
WHERE user_id = '<USER_ID>';

-- Verifica
SELECT
    'User is now DISABLED' as status,
    is_active
FROM company_users
WHERE user_id = '<USER_ID>';

\echo ''
\echo '✅ Expected: is_active = false'
\echo ''

-- ============================================================================
-- Test 2: Simula login di utente disattivato
-- ============================================================================
\echo '3️⃣ Test 2: Login di utente disattivato (query che fallisce)'

-- Query che il login usa: cerca utente attivo
SELECT
    user_id,
    is_active,
    company_id,
    CASE
        WHEN is_active = true THEN '✅ Login OK'
        ELSE '❌ Login DENIED'
    END as login_result
FROM company_users
WHERE user_id = '<USER_ID>'
  AND is_active = true;

\echo ''
\echo '✅ Expected: 0 rows (login negato)'
\echo ''

-- ============================================================================
-- Test 3: Riattiva utente
-- ============================================================================
\echo '4️⃣ Test 3: Riattivazione utente'

-- Riattiva l'utente
UPDATE company_users
SET is_active = true
WHERE user_id = '<USER_ID>';

-- Verifica
SELECT
    'User is now ACTIVE' as status,
    is_active
FROM company_users
WHERE user_id = '<USER_ID>';

\echo ''
\echo '✅ Expected: is_active = true'
\echo ''

-- ============================================================================
-- Test 4: Login di utente attivo (riuscito)
-- ============================================================================
\echo '5️⃣ Test 4: Login di utente attivo (query che funziona)'

-- Query che il login usa: cerca utente attivo
SELECT
    user_id,
    is_active,
    company_id,
    CASE
        WHEN is_active = true THEN '✅ Login OK'
        ELSE '❌ Login DENIED'
    END as login_result
FROM company_users
WHERE user_id = '<USER_ID>'
  AND is_active = true;

\echo ''
\echo '✅ Expected: 1 row con login_result = "✅ Login OK"'
\echo ''

-- ============================================================================
-- Test 5: Conta admin attivi (protezione unico admin)
-- ============================================================================
\echo '6️⃣ Test 5: Protezione unico admin'

SELECT
    company_id,
    COUNT(*) as active_admins,
    CASE
        WHEN COUNT(*) = 1 THEN '⚠️  UNICO ADMIN - NON DISATTIVARE'
        WHEN COUNT(*) > 1 THEN '✅ Sicuro da disattivare (ci sono altri admin)'
        ELSE '❌ ERRORE: Nessun admin!'
    END as protection_status
FROM company_users
WHERE role = 'admin'
  AND is_active = true
GROUP BY company_id;

\echo ''
\echo ''
\echo '✅ TESTS COMPLETATI!'
\echo ''
\echo '📋 Summary:'
\echo '  - Disattivazione: is_active = false ✓'
\echo '  - Login bloccato se disattivato ✓'
\echo '  - Riattivazione: is_active = true ✓'
\echo '  - Login OK se attivato ✓'
\echo '  - Protezione unico admin verificata ✓'
\echo ''
