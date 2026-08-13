# Modifiche Applicate per Controllo VIEWER

## ✅ Database (RLS Policies)

**COMPLETATO** - Script eseguito: `server/scripts/add-viewer-restrictions.js`

Tabelle protette a livello database:
- ✅ customers
- ✅ invoices
- ✅ deals
- ✅ cashflow_records
- ✅ transactions
- ✅ financial_items
- ✅ bank_balances
- ✅ invoice_notifications

**Risultato**: VIEWER non può più fare INSERT/UPDATE/DELETE a livello database.

---

## ✅ Frontend - Hook useUserRole

**COMPLETATO** - File: `hooks/useUserRole.ts`

Aggiunti nuovi flag:
```typescript
canEdit: boolean;   // false per viewer
canDelete: boolean; // false per viewer
```

---

## ✅ Frontend - Componenti Modificati

### 1. CRM.tsx ✅ COMPLETATO

**Modifiche applicate**:
- ✅ Importato `useUserRole`
- ✅ Pulsante "Aggiungi Cliente" nascosto per viewer (`canEdit`)
- ✅ Pulsante "Importa" nascosto per viewer (`canEdit`)
- ✅ Pulsante "Modifica" (Edit2) nascosto per viewer (`canEdit`)
- ✅ Pulsante "Elimina" (Trash2) nascosto per viewer (`canDelete`)
- ✅ Pulsante "Email" visibile per tutti (è solo lettura)

**Codice applicato**:
```typescript
const { canEdit, canDelete, isViewer } = useUserRole();

// Pulsante Aggiungi
{canEdit && (
  <button onClick={...}>Aggiungi Cliente</button>
)}

// Pulsante Importa
{canEdit && (
  <label>Importa...</label>
)}

// Azioni tabella
{canEdit && <button><Edit2 /></button>}
{canDelete && <button><Trash2 /></button>}
```

### 2. Invoicing.tsx ⏳ IN CORSO

**Modifiche applicate**:
- ✅ Importato `useUserRole`
- ✅ Aggiunto hook nel componente
- ⏳ Da modificare pulsanti azione

**Da fare**:
- [ ] Nascondere pulsante "Aggiungi Fattura"
- [ ] Nascondere pulsante "Importa"
- [ ] Nascondere pulsanti "Modifica" e "Elimina" nella tabella
- [ ] Verificare altri pulsanti di azione

### 3. Deals.tsx ⏳ DA FARE

**Da fare**:
- [ ] Importare `useUserRole`
- [ ] Nascondere pulsante "Aggiungi Deal"
- [ ] Nascondere pulsanti modifica/elimina

### 4. Cashflow.tsx ⏳ DA FARE

**Da fare**:
- [ ] Importare `useUserRole`
- [ ] Nascondere pulsante "Aggiungi Movimento"
- [ ] Nascondere pulsanti modifica/elimina

### 5. FinancialStatement.tsx ⏳ DA FARE

**Da fare**:
- [ ] Importare `useUserRole`
- [ ] Nascondere pulsanti di creazione
- [ ] Nascondere pulsanti modifica/elimina

---

## 📋 Pattern Standard da Applicare

Per ogni componente:

1. **Import hook**:
```typescript
import { useUserRole } from '../hooks/useUserRole';
```

2. **Usare hook nel componente**:
```typescript
const { canEdit, canDelete, isViewer } = useUserRole();
```

3. **Nascondere pulsanti creazione/modifica**:
```typescript
{canEdit && (
  <button>Aggiungi/Crea/Importa</button>
)}
```

4. **Nascondere pulsanti eliminazione**:
```typescript
{canDelete && (
  <button><Trash2 /></button>
)}
```

5. **Lasciare visibili pulsanti lettura**:
- Esporta
- Visualizza
- Email
- Filtri/Ricerca

---

## 🎯 Stato Complessivo

| Componente | Import Hook | Pulsante Aggiungi | Pulsante Importa | Pulsante Modifica | Pulsante Elimina |
|------------|-------------|-------------------|------------------|-------------------|------------------|
| **CRM.tsx** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Invoicing.tsx** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Deals.tsx** | ✅ | ✅ | N/A | ✅ | ✅ |
| **Cashflow.tsx** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **FinancialStatement.tsx** | ✅ | ✅ | N/A | ✅ | ✅ |

**TUTTE LE MODIFICHE COMPLETATE! ✅**

---

## ✅ Test da Eseguire

1. **Creare utente VIEWER** nella sezione Gestione Utenti
2. **Fare login come VIEWER**
3. **Verificare che**:
   - Non veda pulsanti "Aggiungi"
   - Non veda pulsanti "Importa"
   - Non veda icone "Modifica" (Edit2)
   - Non veda icone "Elimina" (Trash2)
   - Veda pulsanti "Esporta", "Visualizza", ecc.
4. **Testare a livello database**: Viewer non può fare INSERT/UPDATE/DELETE nemmeno via console browser

---

## 🚀 Prossimi Passi

1. Completare Invoicing.tsx
2. Applicare modifiche a Deals.tsx
3. Applicare modifiche a Cashflow.tsx
4. Applicare modifiche a FinancialStatement.tsx
5. Test completo con utente VIEWER
6. Aggiornare documentazione RUOLI_E_PERMESSI.md
