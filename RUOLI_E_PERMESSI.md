# 🔐 Schema Ruoli e Permessi - Ncode ERP

> Ultimo aggiornamento: 20 Gennaio 2026

## 📋 Panoramica

Il sistema utilizza 4 ruoli con permessi gerarchici:

```
Admin > Manager > User > Viewer
```

---

## 🎭 RUOLI DISPONIBILI

### 1️⃣ ADMIN (Amministratore)
**Descrizione**: Controllo completo dell'azienda e di tutti gli utenti

#### ✅ Permessi Applicativi (Frontend)
- ✅ **Gestione Utenti** (ESCLUSIVO)
  - Creare nuovi utenti/inviti
  - Modificare ruoli e permessi
  - Attivare/disattivare utenti
  - Eliminare utenti (eccetto se stesso e l'ultimo admin)
  - Reinviare inviti

- ✅ **Gestione Impostazioni** (ESCLUSIVO)
  - Configurare email (SMTP/Gmail OAuth2)
  - Modificare impostazioni azienda
  - Configurare integrazioni

- ✅ **Gestione Dati Completa**
  - Tutti i permessi di Manager, User e Viewer
  - Accesso a tutte le funzionalità

#### 🔒 Permessi Database (RLS)
| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `settings` | ✅ | ✅ | ✅ | ❌ |
| `users` | ✅ | ✅ | ✅ | ✅ |
| `company_users` | ✅ | ✅ | ✅ | ✅ |
| `customers` | ✅ | ✅ | ✅ | ✅ |
| `invoices` | ✅ | ✅ | ✅ | ✅ |
| `deals` | ✅ | ✅ | ✅ | ✅ |
| `cashflow_records` | ✅ | ✅ | ✅ | ✅ |
| `transactions` | ✅ | ✅ | ✅ | ✅ |
| `financial_items` | ✅ | ✅ | ✅ | ✅ |
| `bank_balances` | ✅ | ✅ | ✅ | ✅ |
| `invoice_notifications` | ✅ | ✅ | ✅ | ✅ |
| `user_invitations` | ✅ | ❌* | ❌ | ✅ |

> *Gli inviti vengono creati server-side tramite API

---

### 2️⃣ MANAGER
**Descrizione**: Gestisce dati aziendali ma non gli utenti

#### ✅ Permessi Applicativi (Frontend)
- ✅ **Gestione Dati Aziendali**
  - Creare/modificare/eliminare clienti
  - Creare/modificare/eliminare fatture
  - Gestire flusso di cassa
  - Gestire deal e opportunità
  - Gestire transazioni finanziarie
  - Visualizzare report e dashboard

- ❌ **NON PUÒ**
  - Gestire utenti
  - Modificare impostazioni azienda
  - Configurare email/integrazioni

#### 🔒 Permessi Database (RLS)
| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `settings` | ✅ | ❌ | ❌ | ❌ |
| `users` | ✅ | ❌ | ❌ | ❌ |
| `company_users` | ✅ | ❌ | ❌ | ❌ |
| `customers` | ✅ | ✅ | ✅ | ✅ |
| `invoices` | ✅ | ✅ | ✅ | ✅ |
| `deals` | ✅ | ✅ | ✅ | ✅ |
| `cashflow_records` | ✅ | ✅ | ✅ | ✅ |
| `transactions` | ✅ | ✅ | ✅ | ✅ |
| `financial_items` | ✅ | ✅ | ✅ | ✅ |
| `bank_balances` | ✅ | ✅ | ✅ | ✅ |
| `invoice_notifications` | ✅ | ✅ | ✅ | ✅ |
| `user_invitations` | ✅ | ❌ | ❌ | ❌ |

---

### 3️⃣ USER (Utente Standard)
**Descrizione**: Operazioni quotidiane base

#### ✅ Permessi Applicativi (Frontend)
- ✅ **Operazioni Base**
  - Visualizzare clienti, fatture, deal
  - Creare/modificare record operativi
  - Inserire movimenti di cassa
  - Visualizzare report base

- ❌ **NON PUÒ**
  - Gestire utenti
  - Modificare impostazioni
  - Eliminare dati critici (dipende dall'implementazione futura)

#### 🔒 Permessi Database (RLS)
| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `settings` | ✅ | ❌ | ❌ | ❌ |
| `users` | ✅ | ❌ | ❌ | ❌ |
| `company_users` | ✅ | ❌ | ❌ | ❌ |
| `customers` | ✅ | ✅ | ✅ | ✅ |
| `invoices` | ✅ | ✅ | ✅ | ✅ |
| `deals` | ✅ | ✅ | ✅ | ✅ |
| `cashflow_records` | ✅ | ✅ | ✅ | ✅ |
| `transactions` | ✅ | ✅ | ✅ | ✅ |
| `financial_items` | ✅ | ✅ | ✅ | ✅ |
| `bank_balances` | ✅ | ✅ | ✅ | ✅ |
| `invoice_notifications` | ✅ | ✅ | ✅ | ✅ |
| `user_invitations` | ✅ | ❌ | ❌ | ❌ |

> **Nota**: Attualmente USER ha gli stessi permessi DB di MANAGER. La distinzione è solo a livello applicativo.

---

### 4️⃣ VIEWER (Visualizzatore)
**Descrizione**: Solo lettura - nessuna modifica

#### ✅ Permessi Applicativi (Frontend)
- ✅ **Sola Lettura**
  - Visualizzare clienti
  - Visualizzare fatture
  - Visualizzare deal
  - Visualizzare report
  - Visualizzare dashboard

- ❌ **NON PUÒ**
  - Creare/modificare/eliminare NULLA
  - Gestire utenti
  - Modificare impostazioni

#### 🔒 Permessi Database (RLS)
| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `settings` | ✅ | ❌ | ❌ | ❌ |
| `users` | ✅ | ❌ | ❌ | ❌ |
| `company_users` | ✅ | ❌ | ❌ | ❌ |
| `customers` | ✅ | ✅* | ✅* | ✅* |
| `invoices` | ✅ | ✅* | ✅* | ✅* |
| `deals` | ✅ | ✅* | ✅* | ✅* |
| `cashflow_records` | ✅ | ✅* | ✅* | ✅* |
| `transactions` | ✅ | ✅* | ✅* | ✅* |
| `financial_items` | ✅ | ✅* | ✅* | ✅* |
| `bank_balances` | ✅ | ✅* | ✅* | ✅* |
| `invoice_notifications` | ✅ | ✅* | ✅* | ✅* |
| `user_invitations` | ✅ | ❌ | ❌ | ❌ |

> **⚠️ IMPORTANTE**: Gli asterischi (*) indicano che a livello DATABASE il viewer ha permessi, ma dovrebbero essere bloccati a livello APPLICATIVO. **Da implementare controlli nel frontend**.

---

## 🔍 STATO ATTUALE DEL SISTEMA

### ✅ Implementato
- ✅ Sistema ruoli base funzionante
- ✅ Hook `useUserRole()` per controllo ruoli
- ✅ RLS policies per isolamento multi-tenant
- ✅ Gestione utenti solo per Admin
- ✅ Gestione settings solo per Admin

### ⚠️ Da Implementare
- ⚠️ **Controlli granulari per VIEWER** - Attualmente può modificare dati a livello DB
- ⚠️ **Distinzione USER vs MANAGER** - Stesso livello di accesso DB
- ⚠️ **Audit log** - Tracciamento modifiche per compliance
- ⚠️ **Permessi per singola risorsa** - Es. "può modificare solo le sue fatture"

---

## 📊 PERMESSI HOOK `useUserRole()`

```typescript
interface UserRoleData {
  role: 'admin' | 'manager' | 'user' | 'viewer';

  // Boolean helpers
  isAdmin: boolean;      // role === 'admin'
  isManager: boolean;    // role === 'manager'
  isUser: boolean;       // role === 'user'
  isViewer: boolean;     // role === 'viewer'

  // Permission flags (applicativi)
  canManageUsers: boolean;    // Solo admin
  canManageCompany: boolean;  // Admin o Manager
  canViewAll: boolean;        // Tutti tranne viewer
}
```

### Utilizzo nei componenti:

```typescript
import { useUserRole } from '../hooks/useUserRole';

const MyComponent = () => {
  const { isAdmin, canManageUsers, canManageCompany } = useUserRole();

  // Solo admin vede gestione utenti
  if (canManageUsers) {
    return <UserManagementButton />;
  }

  // Admin e Manager vedono impostazioni azienda
  if (canManageCompany) {
    return <CompanySettingsButton />;
  }
};
```

---

## 🛡️ SICUREZZA MULTI-TENANT

### RLS (Row Level Security)

Tutte le tabelle hanno RLS abilitato con questa regola base:

```sql
-- Esempio: policy SELECT su customers
CREATE POLICY "Users can view company customers" ON customers
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );
```

**Cosa significa**:
- Ogni utente vede SOLO i dati della propria azienda (`company_id`)
- L'utente deve essere attivo (`is_active = true`)
- La sicurezza è garantita a livello database (impossibile bypassare dal frontend)

### Eccezioni (policies specifiche per ruolo):

#### Settings (solo Admin)
```sql
WHERE role = 'admin' AND is_active = true
```

#### User Invitations
- SELECT: Tutti i membri della company
- DELETE: Tutti i membri della company
- INSERT: Solo server-side (API backend)

---

## 🎯 RACCOMANDAZIONI

### 1. Implementare controlli VIEWER nel frontend
```typescript
// Esempio da aggiungere nei componenti di modifica
const { canViewAll } = useUserRole();

if (!canViewAll) {
  // Nascondi pulsanti modifica/elimina per viewer
  return <ReadOnlyView />;
}
```

### 2. Aggiungere RLS policies specifiche per ruolo
Attualmente le policies non distinguono tra USER/MANAGER/VIEWER a livello DB.

### 3. Implementare audit log
Per tracciare chi ha modificato cosa e quando.

### 4. Considerare permessi granulari
Es. "può modificare solo fatture che ha creato lui"

---

## 📝 NOTE TECNICHE

- **Gerarchia**: Admin > Manager > User > Viewer
- **Multi-tenant**: Isolamento completo tra aziende
- **Sicurezza**: RLS garantisce separazione dati
- **Flessibilità**: Sistema espandibile con nuovi ruoli
- **Hook**: `useUserRole()` centralizza la logica permessi

---

**Fine documento** - Per domande o modifiche contattare l'amministratore di sistema.
