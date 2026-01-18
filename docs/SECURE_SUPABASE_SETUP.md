# 🔒 Guida: Configurazione Sicura Supabase

## 🎯 Obiettivo

Configurare Supabase locale in modo sicuro, limitando l'accesso solo a localhost e proteggendo i dati con Row Level Security.

---

## 📝 Checklist Rapida

- [ ] Porte limitate a localhost (127.0.0.1)
- [ ] RLS abilitata su tutte le tabelle
- [ ] Password database cambiata
- [ ] API keys rimosse dal client
- [ ] Firewall abilitato
- [ ] Testing completato

---

## 1️⃣ Limitare Porte a Localhost

### Trova la configurazione Docker

```bash
# Cerca file di configurazione Supabase
ls supabase/docker-compose.yml 2>/dev/null || \
ls ~/Library/Application\ Support/com.docker.docker/*/docker-compose.yml 2>/dev/null
```

### Modifica Port Binding

**File**: `docker-compose.yml` o configurazione Docker Desktop

**Prima** (INSICURO):
```yaml
services:
  kong:
    ports:
      - "54321:8000"  # ❌ Esposto su tutte le interfacce

  db:
    ports:
      - "54322:5432"  # ❌ Esposto su tutte le interfacce
```

**Dopo** (SICURO):
```yaml
services:
  kong:
    ports:
      - "127.0.0.1:54321:8000"  # ✅ Solo localhost

  db:
    ports:
      - "127.0.0.1:54322:5432"  # ✅ Solo localhost
```

### Riavvia Supabase

```bash
supabase stop
supabase start
```

### Verifica

```bash
# Controlla che le porte siano su 127.0.0.1
netstat -an | grep LISTEN | grep -E "(54321|54322)"

# Dovrebbe mostrare:
# tcp4  0  0  127.0.0.1:54321  *.*  LISTEN  ✅
# tcp4  0  0  127.0.0.1:54322  *.*  LISTEN  ✅

# NON dovrebbe mostrare:
# tcp4  0  0  *:54321  *.*  LISTEN  ❌
```

---

## 2️⃣ Abilitare Row Level Security (RLS)

### Applica lo script SQL

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f sql/enable_rls_all_tables.sql
```

### Verifica RLS Abilitata

```sql
-- Tutte le tabelle dovrebbero avere RLS ENABLED
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY status, tablename;
```

### Test Isolamento Multi-Tenant

```sql
-- Login come User 1 (Company A)
SET app.current_user_id = 'user-1-uuid';

-- Prova a leggere dati di Company B
SELECT * FROM invoices WHERE company_id = 'company-b-uuid';
-- ✅ Dovrebbe restituire 0 righe (anche se esistono)

-- Verifica di vedere solo i tuoi dati
SELECT COUNT(*) FROM invoices;
-- ✅ Dovrebbe mostrare solo le tue fatture
```

---

## 3️⃣ Rimuovere API Keys dal Client

### ❌ NON FARE (Insicuro)

```env
# .env
VITE_ANTHROPIC_API_KEY=sk-ant-xxx  # ❌ Esposto nel bundle JavaScript!
```

```typescript
// lib/reconciliation-ai.ts
const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;  // ❌ Visibile nel browser!
```

### ✅ SOLUZIONE 1: Solo da Database (Semplice)

**File**: `lib/reconciliation-ai.ts`

```typescript
function getAnthropicClient(): Anthropic {
  const settings = getAISettings(); // Leggi da localStorage (salvato da DB)

  if (!settings?.anthropicApiKey) {
    throw new Error('🔑 Configura API Key nelle Impostazioni');
  }

  return new Anthropic({
    apiKey: settings.anthropicApiKey,
    dangerouslyAllowBrowser: true  // ⚠️ Ancora un rischio
  });
}
```

**Rimuovi da .env**:
```bash
# Commenta o rimuovi
# VITE_ANTHROPIC_API_KEY=xxx
```

### ✅ SOLUZIONE 2: Backend Proxy (Raccomandato)

**Crea API Route Server-Side**:

```typescript
// pages/api/ai-match.ts (se usi Next.js)
// o server/api/ai-match.ts (se usi Express)

export default async function handler(req, res) {
  // API key letta SOLO server-side (mai esposta)
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const anthropic = new Anthropic({
    apiKey,
    // Non serve dangerouslyAllowBrowser sul server!
  });

  const result = await anthropic.messages.create({
    // ... chiamata Anthropic
  });

  res.json(result);
}
```

**Client chiama il tuo backend**:
```typescript
// lib/reconciliation-ai.ts
async function suggestMatch(transaction, invoices) {
  // Chiama il TUO backend invece di Anthropic direttamente
  const response = await fetch('/api/ai-match', {
    method: 'POST',
    body: JSON.stringify({ transaction, invoices }),
    headers: { 'Content-Type': 'application/json' }
  });

  return response.json();
}
```

**Vantaggi**:
- ✅ API key mai esposta nel client
- ✅ Controllo accessi server-side
- ✅ Rate limiting e caching possibili
- ✅ Conformità termini di servizio Anthropic

---

## 4️⃣ Limitare Dev Server a Localhost

### File: `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    host: '127.0.0.1',  // ✅ Solo localhost
    port: 5173,
    strictPort: true
  },
  // ... resto della config
});
```

### Riavvia Dev Server

```bash
npm run dev
```

### Verifica

```bash
# Dovrebbe mostrare:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://127.0.0.1:5173/  ✅
# ➜  Network: use --host to expose
```

---

## 5️⃣ Cambiare Password Database

### File: `supabase/config.toml`

**Trova la sezione**:
```toml
[db]
password = "postgres"  # ❌ Password di default
```

**Cambia a password sicura**:
```toml
[db]
password = "Sup3rS3cur3P@ssw0rd!2026"  # ✅ Password forte
```

### Riavvia Supabase

```bash
supabase stop
supabase db reset  # Reset con nuova password
supabase start
```

### Aggiorna .env (se necessario)

```env
# Se usi connection string diretta
DATABASE_URL=postgresql://postgres:Sup3rS3cur3P@ssw0rd!2026@127.0.0.1:54322/postgres
```

---

## 6️⃣ Abilitare Firewall (macOS)

### Verifica Stato

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

### Abilita Firewall

```bash
# Abilita
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Blocca connessioni in entrata non autorizzate
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setblockall off
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on

# Abilita logging
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setloggingmode on
```

### Permetti Solo App Necessarie

```bash
# Permetti app specifiche
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Docker.app
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /Applications/Docker.app
```

---

## 7️⃣ Testing Sicurezza

### Test 1: Verifica Porte Non Esposte

**Da un altro computer nella stessa rete**:
```bash
# Sostituisci <YOUR_IP> con il tuo IP locale
telnet <YOUR_IP> 54322

# ✅ Dovrebbe fallire: Connection refused
# ❌ Se si connette = PROBLEMA!
```

### Test 2: Verifica RLS Funzionante

```bash
# Login come User A (Company 1)
psql "postgresql://postgres:password@127.0.0.1:54322/postgres"

# Imposta user context
SELECT set_config('request.jwt.claims', '{"sub": "user-a-uuid"}', false);

# Prova a leggere dati di Company 2
SELECT * FROM invoices WHERE company_id = 'company-2-uuid';

# ✅ Dovrebbe restituire 0 righe
```

### Test 3: Verifica API Key Non Esposta

```bash
# Build produzione
npm run build

# Cerca API keys nel bundle
grep -r "sk-ant-" dist/assets/*.js

# ✅ Non dovrebbe trovare nulla
# ❌ Se trova qualcosa = PROBLEMA!
```

### Test 4: Penetration Testing Base

```bash
# Installa nmap (se non hai)
brew install nmap

# Scansione porte sulla tua macchina
nmap -p 54321,54322,5173 127.0.0.1

# ✅ Dovrebbe mostrare:
# 54321/tcp open  (solo se Supabase attivo)
# 54322/tcp open  (solo se Supabase attivo)
# 5173/tcp  open  (solo se dev server attivo)

# Da rete esterna (altro computer)
nmap -p 54321,54322,5173 <YOUR_IP>

# ✅ Dovrebbe mostrare:
# 54321/tcp filtered (firewall blocca)
# 54322/tcp filtered (firewall blocca)
# 5173/tcp  filtered (firewall blocca)
```

---

## 📊 Checklist Post-Configurazione

| Item | Check | Note |
|------|-------|------|
| Porte su 127.0.0.1 | ✅ | `netstat -an \| grep LISTEN` |
| RLS abilitata | ✅ | Tutte le tabelle |
| Policies create | ✅ | `SELECT * FROM pg_policies` |
| API keys rimosse | ✅ | Non in VITE_ vars |
| Password DB cambiata | ✅ | Non più "postgres" |
| Firewall abilitato | ✅ | `sudo pfctl -s all` |
| Test RLS OK | ✅ | Isolamento funzionante |
| Test porte OK | ✅ | Non raggiungibili da esterno |
| Bundle verificato | ✅ | No API keys nel dist/ |

---

## 🚨 Se Qualcosa Non Funziona

### Problema: "Permission denied" dopo RLS

**Causa**: Le policies potrebbero essere troppo restrittive

**Soluzione**:
```sql
-- Temporaneamente disabilita RLS per debug
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- Test query
SELECT * FROM invoices;

-- Riabilita
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Verifica policies
SELECT * FROM pg_policies WHERE tablename = 'invoices';
```

### Problema: Porte ancora esposte dopo config

**Causa**: Docker potrebbe non aver ricaricato la configurazione

**Soluzione**:
```bash
# Stop completo
supabase stop
docker ps -a  # Verifica che non ci siano container

# Rimuovi container
docker rm -f $(docker ps -aq)

# Restart
supabase start
```

### Problema: Firewall blocca anche localhost

**Causa**: Configurazione firewall troppo aggressiva

**Soluzione**:
```bash
# Verifica regole
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps

# Permetti Docker
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /Applications/Docker.app
```

---

## 📚 Risorse Aggiuntive

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Docker Network Security](https://docs.docker.com/network/)
- [macOS Firewall Guide](https://support.apple.com/guide/mac-help/mchlp1147/mac)

---

## ✅ Conclusione

Seguendo questa guida:
- ✅ Database accessibile solo da localhost
- ✅ Dati isolati per company (multi-tenant sicuro)
- ✅ API keys protette
- ✅ Firewall configurato
- ✅ Sistema pronto per produzione

**Prossimi Step**:
1. Implementare backend proxy per API calls
2. Configurare SSL/TLS per produzione
3. Setup monitoring e alerting
4. Pianificare backup regolari
