# 🔒 Regole di Attivazione/Disattivazione Utenti

## 📋 Overview

Implementato un sistema robusto per la gestione dello stato attivo/disattivo degli utenti con regole di sicurezza per prevenire auto-sabotaggio.

---

## ✅ Regole Implementate

### 1. **Auto-Eliminazione Proibita** (User Management)

❌ **Un utente NON può eliminare se stesso** dal pannello "Gestione Utenti"

**Comportamento**:
- Pulsante "Elimina" disabilitato per l'utente corrente
- Tooltip: "Non puoi eliminare te stesso da questo pannello"
- Se tenta comunque: Alert con messaggio di errore

**Dove può eliminarsi**:
✅ **Profilo → Zona Pericolosa → Elimina Account**

**Codice**:
```typescript
// UserManagement.tsx
const handleDeleteUser = async (userId: string) => {
  if (userId === currentUser?.id) {
    alert("Non puoi eliminare te stesso da questo pannello. Usa la sezione Profilo > Zona Pericolosa per eliminare il tuo account.");
    return;
  }
  // ... resto del codice
};
```

---

### 2. **Auto-Disattivazione Proibita** (User Management)

❌ **Un utente NON può disattivare se stesso** dal pannello "Gestione Utenti"

**Comportamento**:
- Toggle "Attivo/Disattivo" disabilitato per l'utente corrente
- Toggle visivamente disabilitato (opacity 50%)
- Tooltip: "Non puoi disattivare te stesso"
- Se tenta comunque: Alert con messaggio di errore

**Dove può disattivarsi**:
✅ **Profilo → (in futuro, se necessario)**

**Codice**:
```typescript
// UserManagement.tsx
const handleToggleActive = async (user: User) => {
  if (user.id === currentUser?.id) {
    alert("Non puoi disattivare te stesso. Usa la sezione Profilo per gestire il tuo account.");
    return;
  }
  // ... resto del codice
};
```

---

### 3. **Login Bloccato per Utenti Disattivati**

❌ **Un utente con `is_active = false` NON può fare login**

**Comportamento**:
1. Utente inserisce email/password corrette
2. Sistema verifica credenziali con Supabase Auth ✅
3. Sistema controlla `is_active` in `company_users` ❌
4. Se `is_active = false`:
   - Logout immediato
   - Errore: "Account disabilitato. Contatta l'amministratore."
5. Se `is_active = true`:
   - Login completato ✅

**Codice**:
```typescript
// AuthContext.tsx - signIn()
const { data: companyUser } = await supabase
  .from('company_users')
  .select('is_active, company_id')
  .eq('user_id', data.user.id)
  .eq('is_active', true)
  .single();

if (!companyUser) {
  await supabase.auth.signOut();
  return { error: new Error('Account disabilitato. Contatta l\'amministratore.') };
}
```

---

### 4. **Protezione Unico Admin**

❌ **L'unico admin attivo NON può essere disattivato o eliminato**

**Comportamento**:
- Pulsanti disabilitati se è l'unico admin attivo
- Tooltip: "Non puoi disattivare/eliminare l'unico amministratore attivo"
- Alert se tenta comunque

**Codice**:
```typescript
// UserManagement.tsx
const isOnlyAdmin = (user: User) => {
  const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active);
  return activeAdmins.length === 1 && activeAdmins[0].id === user.id;
};

if (user.is_active && isOnlyAdmin(user)) {
  alert("Non puoi disattivare l'unico amministratore attivo. Aggiungi un altro amministratore prima di procedere.");
  return;
}
```

---

## 🧪 Testing

### Test 1: Tentativo di Auto-Eliminazione

**Passi**:
1. Login come utente A
2. Vai su "Gestione Utenti"
3. Trova il tuo account nella lista
4. Controlla pulsante "Elimina"

**Risultato Atteso**:
- ✅ Pulsante disabilitato (grigio, opacity 50%)
- ✅ Tooltip: "Non puoi eliminare te stesso da questo pannello"
- ✅ Se clicchi: nessuna azione

**Verifica**:
```typescript
// Il pulsante ha disabled={user.id === currentUser?.id}
disabled={isOnlyAdmin(user) || user.id === currentUser?.id}
```

---

### Test 2: Tentativo di Auto-Disattivazione

**Passi**:
1. Login come utente A (attivo)
2. Vai su "Gestione Utenti"
3. Trova il tuo account nella lista
4. Clicca toggle "Attivo/Disattivo"

**Risultato Atteso**:
- ✅ Toggle disabilitato (grigio, opacity 50%)
- ✅ Tooltip: "Non puoi disattivare te stesso"
- ✅ Alert: "Non puoi disattivare te stesso. Usa la sezione Profilo per gestire il tuo account."

**Verifica**:
```typescript
// Il toggle ha disabled={user.id === currentUser?.id}
disabled={user.id === currentUser?.id}
```

---

### Test 3: Login con Account Disattivato

**Setup**:
```sql
-- Disattiva un utente (come admin)
UPDATE company_users
SET is_active = false
WHERE user_id = 'user-test-uuid';
```

**Passi**:
1. Logout
2. Tenta login con l'utente disattivato
3. Inserisci email e password corrette

**Risultato Atteso**:
- ✅ Credenziali verificate da Supabase Auth
- ✅ Sistema controlla `is_active = false`
- ✅ Logout automatico
- ✅ Errore: "Account disabilitato. Contatta l'amministratore."
- ✅ Utente rimane sulla pagina di login

**Console Output**:
```
🚫 User is disabled or not found in company_users
```

**Verifica nel Database**:
```sql
-- Verifica che l'utente sia disattivato
SELECT user_id, is_active
FROM company_users
WHERE user_id = 'user-test-uuid';

-- Risultato atteso:
-- user_id              | is_active
-- user-test-uuid       | false
```

---

### Test 4: Riattivazione Account (come Admin)

**Passi**:
1. Login come admin
2. Vai su "Gestione Utenti"
3. Trova l'utente disattivato (toggle grigio "Disattivo")
4. Clicca toggle per riattivare

**Risultato Atteso**:
- ✅ Toggle diventa verde "Attivo"
- ✅ Database: `is_active = true`
- ✅ L'utente ora può fare login

**Verifica**:
```sql
-- Verifica riattivazione
SELECT user_id, is_active
FROM company_users
WHERE user_id = 'user-test-uuid';

-- Risultato atteso:
-- user_id              | is_active
-- user-test-uuid       | true
```

---

### Test 5: Protezione Unico Admin

**Setup**: Solo 1 admin attivo nella company

**Passi**:
1. Login come unico admin
2. Vai su "Gestione Utenti"
3. Trova il tuo account (admin)
4. Tenta di disattivare

**Risultato Atteso**:
- ✅ Toggle disabilitato (doppia protezione: auto-disable + unico admin)
- ✅ Alert: "Non puoi disattivare l'unico amministratore attivo. Aggiungi un altro amministratore prima di procedere."

**Verifica**:
```sql
-- Conta admin attivi
SELECT COUNT(*) as admin_count
FROM company_users
WHERE role = 'admin'
  AND is_active = true
  AND company_id = 'company-uuid';

-- Risultato atteso: admin_count = 1
```

---

## 🔒 Security Matrix

| Azione | Utente su Se Stesso | Admin su Altro Utente | Unico Admin |
|--------|---------------------|----------------------|-------------|
| **Disattiva** | ❌ Bloccato | ✅ Permesso | ❌ Bloccato |
| **Elimina** | ❌ Bloccato (User Mgmt) | ✅ Permesso | ❌ Bloccato |
| **Elimina** (Profilo) | ✅ Permesso | N/A | ❌ Bloccato |
| **Login (disattivo)** | ❌ Bloccato | N/A | N/A |
| **Modifica Ruolo** | ✅ Permesso | ✅ Permesso | ❌ Se cambia a non-admin |

---

## 📊 Flusso di Disattivazione

```
Admin disattiva User B
    ↓
UPDATE company_users SET is_active = false
    ↓
User B tenta login
    ↓
Supabase Auth: ✅ Credenziali OK
    ↓
Sistema: Query company_users con is_active = true
    ↓
Risultato: 0 righe (user is_active = false)
    ↓
Sistema: Logout automatico
    ↓
Errore: "Account disabilitato"
    ↓
User B rimane su pagina login
```

---

## 🎯 File Modificati

### 1. `context/AuthContext.tsx`
- ✅ `signIn()`: Verifica `is_active` dopo autenticazione
- ✅ Logout automatico se disattivato
- ✅ Messaggio errore chiaro

### 2. `components/UserManagement.tsx`
- ✅ `handleToggleActive()`: Blocca auto-disattivazione
- ✅ `handleDeleteUser()`: Blocca auto-eliminazione
- ✅ UI: Toggle disabilitato per se stesso
- ✅ UI: Pulsante elimina disabilitato per se stesso
- ✅ Tooltips informativi

---

## 🚀 Benefici

1. **Prevenzione Auto-Sabotaggio**
   - Utenti non possono accidentalmente disabilitarsi
   - Protezione contro errori umani

2. **Sicurezza Company**
   - Sempre almeno un admin attivo
   - Nessuna company può rimanere senza amministratore

3. **UX Chiara**
   - Pulsanti visivamente disabilitati
   - Tooltips spiegano perché
   - Messaggi di errore chiari

4. **Audit Trail**
   - Console logging di tutte le azioni
   - Facile debugging

---

## 📝 Considerazioni Future

### Soft Delete
Invece di eliminazione immediata, considerare:
- Flag `deleted_at` invece di eliminazione fisica
- Grace period di 30 giorni per recovery
- Email di notifica prima dell'eliminazione definitiva

### Auto-Disattivazione Controllata
Se necessario permettere auto-disattivazione:
- Richiedi conferma tramite email
- Grace period di 24h
- Notifica admin della company

### Logging Avanzato
- Tabella `audit_log` per tracciare disattivazioni
- Chi ha disattivato chi e quando
- Motivo della disattivazione (opzionale)

---

## ✅ Checklist Implementazione

- [x] Login bloccato per utenti disattivati
- [x] Auto-disattivazione bloccata (User Management)
- [x] Auto-eliminazione bloccata (User Management)
- [x] Toggle visivamente disabilitato per se stesso
- [x] Pulsante elimina disabilitato per se stesso
- [x] Protezione unico admin
- [x] Tooltips informativi
- [x] Alert messaggi chiari
- [x] Console logging
- [x] Documentazione completa

---

**Data Implementazione**: 2026-01-17
**Versione**: 1.0
**Status**: ✅ Produzione Ready
