# 🔒 Security Audit Report - nCode ERP

**Data Audit**: 2026-01-17
**Severità**: 🔴 **CRITICA**
**Status**: ⚠️ **VULNERABILITÀ MULTIPLE RILEVATE**

---

## 📋 Executive Summary

Il sistema presenta **VULNERABILITÀ CRITICHE** che espongono:
- ❌ Database pubblicamente accessibile senza autenticazione
- ❌ Dati multi-tenant accessibili senza Row Level Security (RLS)
- ❌ API Keys esposte nel codice client
- ❌ Porte di sviluppo esposte su tutte le interfacce di rete

**RISCHIO**: Accesso non autorizzato a tutti i dati di tutte le companies.

---

## 🚨 Vulnerabilità Critiche

### 1. Row Level Security (RLS) DISABILITATA ⚠️ CRITICO

**Stato Attuale**:
```
22 su 23 tabelle hanno RLS DISABLED
Solo invoice_notifications ha RLS ENABLED
```

**Rischio**:
- Chiunque con accesso al database può leggere/modificare/eliminare dati di TUTTE le companies
- Violazione totale dell'isolamento multi-tenant
- Potenziale data breach di tutti i dati aziendali

**Tabelle Vulnerabili**:
- ❌ users (dati utenti)
- ❌ companies (dati aziende)
- ❌ customers (clienti)
- ❌ invoices (fatture)
- ❌ cashflow_records (movimenti finanziari)
- ❌ bank_transactions (transazioni bancarie)
- ❌ settings (impostazioni con API keys!)
- ❌ Tutte le altre tabelle...

**Impatto**: 🔴 **CRITICO** - Accesso completo a tutti i dati

---

### 2. Porte di Rete Esposte Pubblicamente ⚠️ CRITICO

**Stato Attuale**:
```bash
Porta 54321 (Supabase API):  LISTEN su *:54321  ❌ ESPOSTA
Porta 54322 (Supabase DB):   LISTEN su *:54322  ❌ ESPOSTA
Porta 3000 (Dev Server):     LISTEN su *:3000   ❌ ESPOSTA
```

**Rischio**:
- Database PostgreSQL accessibile da internet senza firewall
- API Supabase accessibile da qualsiasi IP
- Dev server accessibile da rete esterna

**Come Verificare**:
```bash
# Da un altro computer nella stessa rete
curl http://<your-ip>:54321/rest/v1/users

# Se risponde = VULNERABILE
```

**Impatto**: 🔴 **CRITICO** - Accesso remoto non autorizzato

---

### 3. API Keys Esposte nel Client ⚠️ ALTO

**File**: `.env`
```env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-y53if5-Aig1l...
```

**Problema**:
Le variabili che iniziano con `VITE_` vengono **bundlate nel JavaScript client** e sono visibili a chiunque:

1. Apri DevTools (F12)
2. Vai su Sources → main.js
3. Cerca "sk-ant-" → Chiave API visibile!

**Utilizzo Vulnerabile**: `lib/reconciliation-ai.ts:22`
```typescript
const apiKey = settings?.anthropicApiKey || import.meta.env.VITE_ANTHROPIC_API_KEY;
```

**Rischio**:
- Chiunque può rubare la tua API key Anthropic
- Uso fraudolento della chiave → costi a tuo carico
- Violazione dei termini di servizio Anthropic

**Impatto**: 🟠 **ALTO** - Furto credenziali e costi non autorizzati

---

### 4. Autenticazione Database Debole ⚠️ ALTO

**Credenziali Database** (visibili in supabase/config.toml):
```
postgres / postgres
```

**Rischio**:
- Password di default facilmente indovinabile
- Se la porta 54322 è esposta → accesso diretto al DB

**Impatto**: 🟠 **ALTO** - Accesso diretto al database

---

## ✅ Aspetti Positivi

- ✅ `.env` è nel `.gitignore` (chiavi non committate su Git)
- ✅ Autenticazione utenti tramite Supabase Auth funzionante
- ✅ Sistema RBAC implementato correttamente a livello applicazione
- ✅ Triggers database per cleanup automatico utenti

---

## 🛡️ Soluzioni Raccomandate

### 1. ABILITARE Row Level Security (RLS) - PRIORITÀ 1

**Script SQL**: Vedi `sql/enable_rls_all_tables.sql` (creato in questa fix)

**Esempio Policy**:
```sql
-- Utenti possono vedere solo dati della propria company
CREATE POLICY "Users can view own company data"
ON invoices FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Azioni**:
1. Eseguire script per abilitare RLS su tutte le tabelle
2. Creare policies per ogni tabella
3. Testare che l'isolamento multi-tenant funzioni
4. Verificare che gli utenti vedano solo i loro dati

---

### 2. LIMITARE Porte a Localhost - PRIORITÀ 1

**File**: `supabase/config.toml` o `docker-compose.yml`

**Cambiare da**:
```yaml
ports:
  - "54321:54321"  # Espone su tutte le interfacce
  - "54322:54322"
```

**A**:
```yaml
ports:
  - "127.0.0.1:54321:54321"  # Solo localhost
  - "127.0.0.1:54322:54322"
```

**Dev Server** (vite.config.ts):
```typescript
export default defineConfig({
  server: {
    host: '127.0.0.1',  // Solo localhost
    port: 5173
  }
});
```

**Verifica**:
```bash
netstat -an | grep LISTEN | grep 54321
# Dovrebbe mostrare: 127.0.0.1:54321 (non *:54321)
```

---

### 3. RIMUOVERE API Keys dal Client - PRIORITÀ 1

**NON USARE**:
```env
VITE_ANTHROPIC_API_KEY=xxx  ❌ Esposto nel client!
```

**SOLUZIONE 1: Backend Proxy** (Raccomandato)
```typescript
// Creare API route server-side
// pages/api/ai-match.ts
export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY; // Solo server
  // ... chiamata Anthropic
}

// Client chiama il tuo backend
fetch('/api/ai-match', { ... });
```

**SOLUZIONE 2: Solo da Database**
```typescript
// lib/reconciliation-ai.ts
function getAnthropicClient(): Anthropic {
  const settings = getAISettings(); // Solo da DB/localStorage
  // Rimuovere: || import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!settings?.anthropicApiKey) {
    throw new Error('Configura API Key nelle Impostazioni');
  }

  return new Anthropic({
    apiKey: settings.anthropicApiKey,
    dangerouslyAllowBrowser: true
  });
}
```

**Nota**: `dangerouslyAllowBrowser: true` è ancora un rischio. Meglio usare backend proxy.

---

### 4. CAMBIARE Password Database - PRIORITÀ 2

```bash
# Nel file supabase/config.toml
db.password = "password-sicura-casuale-123456789"

# Riavviare Supabase
supabase stop
supabase start
```

---

### 5. ABILITARE Firewall - PRIORITÀ 2

**macOS**:
```bash
# Verifica stato firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Abilita firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Blocca connessioni in entrata
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setblockall on
```

**Linux (ufw)**:
```bash
# Abilita firewall
sudo ufw enable

# Blocca tutto di default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permetti solo SSH se necessario
sudo ufw allow 22/tcp
```

---

## 🧪 Piano di Testing

### Test 1: Verifica RLS Funzionante
```sql
-- Login come User 1 (company A)
-- Prova a leggere dati di company B
SELECT * FROM invoices WHERE company_id = 'company-b-id';
-- Dovrebbe restituire 0 righe (anche se esistono)
```

### Test 2: Verifica Porte Non Esposte
```bash
# Da un altro computer nella rete
telnet <your-ip> 54322
# Dovrebbe fallire: Connection refused
```

### Test 3: Verifica API Key Non Esposta
```bash
# Build produzione
npm run build

# Cerca chiave nel bundle
grep -r "sk-ant-" dist/
# Non dovrebbe trovare nulla
```

---

## 📊 Priorità di Implementazione

| # | Vulnerabilità | Priorità | Tempo Stimato | Rischio |
|---|---------------|----------|---------------|---------|
| 1 | RLS Disabilitata | 🔴 CRITICA | 2-3 ore | Data breach |
| 2 | Porte Esposte | 🔴 CRITICA | 30 min | Accesso remoto |
| 3 | API Keys Client | 🟠 ALTA | 1-2 ore | Furto credenziali |
| 4 | Password DB | 🟡 MEDIA | 15 min | Brute force |
| 5 | Firewall | 🟡 MEDIA | 30 min | Accesso rete |

---

## 📝 Checklist Sicurezza

- [ ] RLS abilitata su tutte le tabelle
- [ ] Policies create per ogni tabella
- [ ] Porte limitate a 127.0.0.1
- [ ] API keys rimosse da VITE_ env vars
- [ ] API keys usate solo server-side o da DB
- [ ] Password database cambiata
- [ ] Firewall abilitato
- [ ] Testing isolamento multi-tenant completato
- [ ] Penetration testing base eseguito
- [ ] Documentazione sicurezza aggiornata

---

## 🔗 Risorse Utili

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)

---

## 📧 Contatti

Per domande su questo audit:
- Creato da: Claude Code
- Data: 2026-01-17
- Versione: 1.0
