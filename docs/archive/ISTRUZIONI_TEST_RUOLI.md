# 🧪 Istruzioni per Test Ruoli e Permessi

## ✅ IMPLEMENTAZIONE COMPLETATA

Tutti i controlli per il ruolo VIEWER sono stati implementati con successo sia a livello **database (RLS)** che **frontend (UI)**.

---

## 📋 Cosa è Stato Fatto

### 1. Database - RLS Policies ✅
Script eseguito: `server/scripts/add-viewer-restrictions.js`

**Tabelle protette**:
- ✅ customers
- ✅ invoices
- ✅ deals
- ✅ cashflow_records
- ✅ transactions
- ✅ financial_items
- ✅ bank_balances
- ✅ invoice_notifications

**Risultato**: I VIEWER non possono più fare INSERT/UPDATE/DELETE a livello database.

### 2. Hook useUserRole ✅
File: `hooks/useUserRole.ts`

Aggiunti nuovi flag:
```typescript
canEdit: boolean;   // false per viewer, true per altri
canDelete: boolean; // false per viewer, true per altri
```

### 3. Componenti Frontend ✅

Tutti i componenti principali sono stati modificati:

#### ✅ CRM.tsx
- Pulsante "Aggiungi Cliente" nascosto
- Pulsante "Importa" nascosto
- Pulsanti "Modifica" ed "Elimina" nascosti
- Pulsante "Email" visibile (sola lettura)

#### ✅ Invoicing.tsx
- Pulsante "Nuova Voce" nascosto
- Pulsante "Importa" nascosto
- Checkbox selezione multipla nascoste
- Banner eliminazione multipla nascosto
- Pulsanti "Modifica" ed "Elimina" nascosti

#### ✅ Deals.tsx
- Pulsante "Nuova Opportunità" nascosto
- Pulsante "Aggiungi" nelle colonne nascosto
- Banner eliminazione multipla nascosto
- Pulsanti "Modifica" ed "Elimina" nelle card nascosti

#### ✅ Cashflow.tsx
- Pulsante "Aggiungi Movimento" nascosto
- Pulsante "Importa" nascosto
- Pulsanti "Modifica" ed "Elimina" nascosti in entrambe le tabelle

#### ✅ FinancialStatement.tsx
- Pulsanti "Aggiungi" nascosti per Attivo e Passivo
- Pulsanti "Modifica" ed "Elimina" nascosti nelle tabelle

---

## 🧪 PIANO DI TEST

### Step 1: Preparazione

1. **Assicurati che il server sia in esecuzione**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

2. **Apri la console del browser** (F12)
   - Servirà per vedere eventuali errori

### Step 2: Test Ruolo ADMIN

1. **Login come admin** (admin@ncodestudio.com)

2. **Vai su "Gestione Utenti"**

3. **Crea 3 utenti di test** (uno per ogni ruolo):
   ```
   - viewer@test.com (ruolo: VIEWER)
   - user@test.com (ruolo: USER)
   - manager@test.com (ruolo: MANAGER)
   ```

4. **Verifica che gli inviti siano stati inviati**
   - Dovrebbero comparire come "Invito pendente"

5. **Controlla email** e completa la registrazione per tutti e 3

6. **Test Admin - Verifica pulsanti visibili**:
   - ✅ CRM: Vedi "Aggiungi Cliente", "Importa", "Modifica", "Elimina"
   - ✅ Invoicing: Vedi "Nuova Voce", "Importa", "Modifica", "Elimina"
   - ✅ Deals: Vedi "Nuova Opportunità", "Aggiungi", "Modifica", "Elimina"
   - ✅ Cashflow: Vedi "Aggiungi Movimento", "Importa", "Modifica", "Elimina"
   - ✅ FinancialStatement: Vedi "Aggiungi", "Modifica", "Elimina"
   - ✅ Settings: Puoi accedere e modificare
   - ✅ Gestione Utenti: Puoi accedere e modificare

### Step 3: Test Ruolo MANAGER

1. **Logout e login come manager@test.com**

2. **Verifica pulsanti visibili** (stesso come Admin):
   - ✅ CRM: Vedi "Aggiungi Cliente", "Importa", "Modifica", "Elimina"
   - ✅ Invoicing: Vedi "Nuova Voce", "Importa", "Modifica", "Elimina"
   - ✅ Deals: Vedi "Nuova Opportunità", "Aggiungi", "Modifica", "Elimina"
   - ✅ Cashflow: Vedi "Aggiungi Movimento", "Importa", "Modifica", "Elimina"
   - ✅ FinancialStatement: Vedi "Aggiungi", "Modifica", "Elimina"

3. **Verifica restrizioni Manager**:
   - ❌ Settings: Non dovrebbe vedere il menu o dovrebbe essere read-only
   - ❌ Gestione Utenti: Non dovrebbe vedere il menu

4. **Prova a creare/modificare/eliminare** un cliente, fattura, deal
   - ✅ Dovrebbe funzionare tutto

### Step 4: Test Ruolo USER

1. **Logout e login come user@test.com**

2. **Verifica pulsanti visibili** (stesso come Manager):
   - ✅ CRM: Vedi "Aggiungi Cliente", "Importa", "Modifica", "Elimina"
   - ✅ Invoicing: Vedi "Nuova Voce", "Importa", "Modifica", "Elimina"
   - ✅ Deals: Vedi "Nuova Opportunità", "Aggiungi", "Modifica", "Elimina"
   - ✅ Cashflow: Vedi "Aggiungi Movimento", "Importa", "Modifica", "Elimina"
   - ✅ FinancialStatement: Vedi "Aggiungi", "Modifica", "Elimina"

3. **Verifica restrizioni User** (stesso come Manager):
   - ❌ Settings: Non dovrebbe vedere
   - ❌ Gestione Utenti: Non dovrebbe vedere

4. **Prova a creare/modificare/eliminare**
   - ✅ Dovrebbe funzionare tutto

### Step 5: Test Ruolo VIEWER (CRITICO!)

1. **Logout e login come viewer@test.com**

2. **Verifica che NON vedi pulsanti di azione**:

#### CRM
- ❌ Non vedi "Aggiungi Cliente"
- ❌ Non vedi "Importa"
- ❌ Non vedi icona "Modifica" (Edit2) nelle righe
- ❌ Non vedi icona "Elimina" (Trash2) nelle righe
- ✅ Vedi solo "Esporta" e "Email"

#### Invoicing
- ❌ Non vedi "Nuova Voce"
- ❌ Non vedi "Importa"
- ❌ Non vedi checkbox di selezione multipla
- ❌ Non vedi icona "Modifica" nelle righe
- ❌ Non vedi icona "Elimina" nelle righe
- ✅ Vedi solo "Esporta"

#### Deals
- ❌ Non vedi "Nuova Opportunità"
- ❌ Non vedi "Aggiungi" nelle colonne
- ❌ Non vedi icone "Modifica" ed "Elimina" nelle card

#### Cashflow
- ❌ Non vedi "Aggiungi Movimento"
- ❌ Non vedi "Importa"
- ❌ Non vedi icone "Modifica" ed "Elimina"
- ✅ Vedi solo "Esporta"

#### FinancialStatement
- ❌ Non vedi pulsanti "Aggiungi"
- ❌ Non vedi icone "Modifica" ed "Elimina"
- ✅ Vedi solo "Esporta" e "Stampa"

3. **Test Database (Importante!)**:
   Apri la Console del Browser (F12 > Console) e prova questi comandi:

```javascript
// Prova a inserire un cliente (DEVE FALLIRE)
await supabase.from('customers').insert({
  name: 'Test Cliente',
  email: 'test@test.com',
  company_id: 'YOUR_COMPANY_ID'
});
// Risultato atteso: Errore 403 o permission denied

// Prova a modificare un cliente (DEVE FALLIRE)
await supabase.from('customers').update({
  name: 'Modified'
}).eq('id', 'SOME_CUSTOMER_ID');
// Risultato atteso: Errore 403 o permission denied

// Prova a eliminare un cliente (DEVE FALLIRE)
await supabase.from('customers').delete().eq('id', 'SOME_CUSTOMER_ID');
// Risultato atteso: Errore 403 o permission denied
```

---

## ✅ Checklist Test Completa

### ADMIN ✅
- [ ] Vede tutti i pulsanti di azione
- [ ] Può creare/modificare/eliminare tutto
- [ ] Accede a Gestione Utenti
- [ ] Accede a Settings

### MANAGER ✅
- [ ] Vede tutti i pulsanti di azione (tranne gestione utenti/settings)
- [ ] Può creare/modificare/eliminare dati
- [ ] NON accede a Gestione Utenti
- [ ] NON accede/modifica Settings

### USER ✅
- [ ] Vede tutti i pulsanti di azione (tranne gestione utenti/settings)
- [ ] Può creare/modificare/eliminare dati
- [ ] NON accede a Gestione Utenti
- [ ] NON accede/modifica Settings

### VIEWER ✅ (IL PIÙ IMPORTANTE!)
- [ ] NON vede pulsanti "Aggiungi"
- [ ] NON vede pulsanti "Importa"
- [ ] NON vede icone "Modifica" (Edit2)
- [ ] NON vede icone "Elimina" (Trash2)
- [ ] NON vede checkbox selezione multipla
- [ ] Vede solo pulsanti "Esporta", "Email", "Visualizza"
- [ ] Test console browser: NON può INSERT
- [ ] Test console browser: NON può UPDATE
- [ ] Test console browser: NON può DELETE
- [ ] Può solo leggere i dati

---

## 🐛 Come Segnalare Problemi

Se trovi problemi durante i test, annota:

1. **Ruolo** con cui hai effettuato il login
2. **Pagina/Componente** dove si verifica il problema
3. **Cosa dovrebbe succedere** vs **Cosa succede**
4. **Eventuali errori in console** (F12)
5. **Screenshot** se possibile

---

## 📊 Report Test

Dopo aver completato i test, compila questo report:

```
DATA TEST: ___________
TESTATO DA: ___________

ADMIN:
- Tutti i pulsanti visibili: [ ]
- Può modificare tutto: [ ]
- Accesso Settings: [ ]
- Accesso Gestione Utenti: [ ]

MANAGER:
- Pulsanti azione visibili: [ ]
- Può modificare dati: [ ]
- NO Settings: [ ]
- NO Gestione Utenti: [ ]

USER:
- Pulsanti azione visibili: [ ]
- Può modificare dati: [ ]
- NO Settings: [ ]
- NO Gestione Utenti: [ ]

VIEWER:
- NO pulsanti Aggiungi: [ ]
- NO pulsanti Importa: [ ]
- NO pulsanti Modifica: [ ]
- NO pulsanti Elimina: [ ]
- Solo lettura: [ ]
- Test DB negato: [ ]

PROBLEMI RISCONTRATI:
_______________________________
_______________________________
_______________________________
```

---

**Buon test! 🚀**
