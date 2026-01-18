# Role-Based Access Control (RBAC) System

## Overview

Sistema completo di gestione ruoli con controlli di permessi robusti per prevenire escalation di privilegi e garantire che solo gli utenti autorizzati possano eseguire operazioni critiche.

## Problema Risolto

### Problema Originale: "Impersonation" Bug
Quando un admin creava un nuovo utente, l'applicazione faceva automaticamente login del nuovo utente, causando il "possesso della pagina" da parte del nuovo account invece di mantenere la sessione dell'admin.

**Causa**: `supabase.auth.signUp()` esegue automaticamente il login dell'utente appena creato, sostituendo la sessione corrente.

**Soluzione**:
1. Salvare la sessione admin prima di creare l'utente
2. Creare il nuovo utente (che causa auto-login)
3. Ripristinare immediatamente la sessione admin
4. Il nuovo utente può fare login separatamente

## Ruoli Disponibili

### 1. Admin (Amministratore)
- **Permessi completi**: Può fare tutto
- **Gestione utenti**: Creare, modificare, eliminare utenti
- **Gestione company**: Modificare settings, eliminare company
- **Protezioni**:
  - Deve esistere sempre almeno un admin attivo
  - L'unico admin non può rimuovere se stesso o cambiare il proprio ruolo

### 2. Manager
- **Gestione dati**: Può gestire customers, deals, invoices, cashflow
- **Visualizzazione**: Accesso completo a tutti i dati
- **Limitazioni**: NON può gestire utenti o settings company

### 3. User (Utente)
- **Operazioni standard**: Può creare e modificare dati
- **Visualizzazione**: Accesso a tutti i dati della company
- **Limitazioni**: NON può gestire utenti

### 4. Viewer (Visualizzatore)
- **Solo lettura**: Può solo visualizzare i dati
- **Limitazioni**: NON può modificare o creare nulla

## Implementazione

### 1. Hook: `useUserRole`

File: `/hooks/useUserRole.ts`

```typescript
const {
  role,           // 'admin' | 'manager' | 'user' | 'viewer' | null
  isAdmin,        // boolean
  isManager,      // boolean
  isUser,         // boolean
  isViewer,       // boolean
  canManageUsers, // boolean - solo admin
  canManageCompany, // boolean - admin e manager
  canViewAll,     // boolean - tutti tranne viewer
  loading         // boolean
} = useUserRole();
```

**Features**:
- Carica automaticamente il ruolo dal database
- Fornisce flags boolean per controlli rapidi
- Gestisce stati di loading
- Reagisce ai cambiamenti di user/company

### 2. Protezione User Management

File: `/components/UserManagement.tsx`

**Controlli Client-Side**:
```typescript
// Blocca l'accesso se non sei admin
if (!canManageUsers) {
  return <AccessDenied />; // UI di errore
}
```

**Controlli Server-Side**: Tutti in `DataContext.tsx`

#### createUser()
```typescript
// Verifica che l'utente corrente sia admin
const { data: currentUserRole } = await supabase
  .from('company_users')
  .select('role')
  .eq('user_id', user.id)
  .eq('company_id', companyId)
  .single();

if (currentUserRole.role !== 'admin') {
  return { error: 'Permesso negato' };
}

// Salva sessione admin
const adminSession = await supabase.auth.getSession();

// Crea nuovo utente (auto-login)
await supabase.auth.signUp({ email, password });

// Ripristina sessione admin
await supabase.auth.setSession(adminSession);
```

#### updateUser()
```typescript
// Solo admin può modificare utenti
const { data: currentUserRole } = await supabase
  .from('company_users')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (currentUserRole.role !== 'admin') {
  return { error: 'Permesso negato' };
}

// Procedi con update...
```

#### deleteUser()
```typescript
// Admin può eliminare altri utenti
// Utenti possono eliminare se stessi (profilo)
if (userId !== user.id) {
  const { data: currentUserRole } = await supabase
    .from('company_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (currentUserRole.role !== 'admin') {
    throw new Error('Permesso negato');
  }
}

// Verifica che non sia l'unico admin
// Procedi con eliminazione...
```

## Flusso Creazione Utente (Corretto)

```
1. Admin apre User Management
   ↓
2. useUserRole verifica che sia admin
   ↓
3. Se non admin → Mostra "Accesso Negato"
   ↓
4. Admin compila form e clicca "Crea Utente"
   ↓
5. createUser() salva sessione admin
   ↓
6. createUser() verifica permessi lato server
   ↓
7. Crea auth user (auto-login nuovo utente)
   ↓
8. Crea record in users table
   ↓
9. Crea link in company_users table
   ↓
10. 🔄 RIPRISTINA sessione admin
   ↓
11. ✅ Admin rimane loggato come admin
    Nuovo utente deve fare login separatamente
```

## Protezioni Implementate

### 1. Doppio Controllo (Client + Server)
- **Client**: UI non mostra opzioni non permesse
- **Server**: Verifica permessi prima di eseguire operazioni

### 2. Prevenzione Session Hijacking
- Salvataggio e ripristino sessione durante creazione utenti
- Logging dettagliato di tutte le operazioni

### 3. Protezione Admin
- Sempre almeno un admin attivo
- Admin non può auto-degradarsi se è l'unico
- Admin non può auto-eliminarsi se è l'unico

### 4. Audit Trail
- Console logging di tutte le operazioni critiche
- Verifica permessi con emoji per facile debugging:
  - ✅ Operazione permessa
  - ❌ Permesso negato
  - 🔄 Ripristino sessione
  - 👤 Creazione utente
  - 🚪 Logout

## Testing

### Test 1: Admin crea nuovo utente
```bash
1. Login come admin
2. Vai su "Gestione Utenti"
3. Clicca "Aggiungi Utente"
4. Inserisci email, nome, password
5. Seleziona ruolo
6. Clicca "Crea"

Risultato atteso:
✅ Utente creato
✅ Admin rimane loggato come admin
✅ Nuovo utente NON è loggato
✅ Console mostra "Admin session restored"
```

### Test 2: Non-admin tenta di accedere a User Management
```bash
1. Login come user/manager/viewer
2. Tenta di navigare a /users

Risultato atteso:
✅ Mostra schermata "Accesso Negato"
✅ Opzione per tornare indietro
✅ Nessuna operazione possibile
```

### Test 3: Admin tenta di eliminare unico admin
```bash
1. Login come unico admin
2. Vai su "Gestione Utenti"
3. Tenta di eliminare se stesso

Risultato atteso:
✅ Pulsante eliminazione disabilitato
✅ Messaggio: "Unico amministratore"
✅ Impossibile procedere
```

### Test 4: Admin tenta di cambiare ruolo di unico admin
```bash
1. Login come unico admin
2. Vai su "Gestione Utenti"
3. Modifica il proprio ruolo da Admin a User

Risultato atteso:
✅ Errore: "Non puoi cambiare il ruolo dell'unico amministratore"
✅ Ruolo rimane Admin
```

## Console Output (Esempio)

Quando un admin crea un nuovo utente:

```
👤 Admin creating new user: nuovo.utente@example.com
✅ Permission check passed: User is admin
💾 Saved admin session: admin@example.com
✅ Created auth user: abc-123-def-456
✅ Created user record
✅ Linked user to company
🔄 Restoring admin session...
✅ Admin session restored: admin@example.com
🎉 User created successfully without impersonation!
```

## File Modificati

### Nuovi File
- `/hooks/useUserRole.ts` - Hook per gestione ruoli
- `/docs/ROLE_BASED_ACCESS_CONTROL.md` - Questa documentazione

### File Modificati
- `/context/DataContext.tsx`
  - `createUser()` - Aggiunto save/restore sessione + controlli permessi
  - `updateUser()` - Aggiunto controllo permessi admin
  - `deleteUser()` - Aggiunto controllo permessi admin

- `/components/UserManagement.tsx`
  - Aggiunto import `useUserRole`
  - Aggiunto controllo accesso (solo admin)
  - Aggiunta UI "Accesso Negato"

## Sicurezza

### Cosa Previene
✅ Session hijacking durante creazione utenti
✅ Escalation di privilegi
✅ Utenti non autorizzati che gestiscono altri utenti
✅ Eliminazione accidentale dell'unico admin
✅ Company senza admin

### Best Practices Implementate
✅ Doppio controllo (client + server)
✅ Principle of least privilege
✅ Fail-safe defaults (negare se in dubbio)
✅ Audit logging
✅ Session management sicuro

## Future Enhancements

1. **Row Level Security (RLS) su Supabase**
   - Policies per limitare accesso a livello database

2. **API Rate Limiting**
   - Prevenire abusi nelle operazioni di gestione utenti

3. **Audit Log Table**
   - Salvare tutte le operazioni critiche in DB

4. **2FA per Admin**
   - Autenticazione a due fattori obbligatoria per admin

5. **Session Timeout**
   - Auto-logout dopo inattività per ruoli sensibili
