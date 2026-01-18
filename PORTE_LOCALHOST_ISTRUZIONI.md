# 🔒 AZIONE RICHIESTA: Limitare Porte a Localhost

## ⚠️ CRITICO - Da Completare Manualmente

Le porte Supabase sono attualmente esposte su tutte le interfacce di rete (`*:54321`, `*:54322`).
Questo significa che chiunque nella tua rete può accedere al database.

**Status attuale**:
```bash
tcp46  0  0  *.54321  *.*  LISTEN  ❌ ESPOSTO
tcp46  0  0  *.54322  *.*  LISTEN  ❌ ESPOSTO
```

**Status desiderato**:
```bash
tcp4   0  0  127.0.0.1:54321  *.*  LISTEN  ✅ SOLO LOCALHOST
tcp4   0  0  127.0.0.1:54322  *.*  LISTEN  ✅ SOLO LOCALHOST
```

---

## 🛠️ Come Risolvere

### Opzione 1: Se usi Supabase CLI

1. **Trova il file di configurazione**:
```bash
# Cerca docker-compose.yml di Supabase
find ~ -name "docker-compose.yml" -path "*/supabase/*" 2>/dev/null
```

2. **Modifica il file**:
```yaml
# File: ~/Library/Application Support/supabase/docker/docker-compose.yml
# (o percorso trovato sopra)

services:
  kong:
    ports:
      - "127.0.0.1:54321:8000"  # Cambia da "54321:8000"

  db:
    ports:
      - "127.0.0.1:54322:5432"  # Cambia da "54322:5432"
```

3. **Riavvia Supabase**:
```bash
supabase stop
supabase start
```

---

### Opzione 2: Se usi Docker Desktop

1. **Apri Docker Desktop**
2. **Vai su Containers**
3. **Trova i container Supabase** (supabase-db, supabase-kong)
4. **Stop i container**
5. **Ricrea con port binding corretto**:

```bash
# Esempio per PostgreSQL
docker run -d \
  --name supabase-db \
  -p 127.0.0.1:54322:5432 \
  postgres:15
```

**Oppure modifica docker-compose.yml** in:
```
~/Library/Containers/com.docker.docker/Data/...
```

---

### Opzione 3: Usa SSH Tunnel (Temporaneo)

Se non riesci a modificare Docker, usa un tunnel SSH come soluzione temporanea:

```bash
# Killa i processi attuali
pkill -f supabase

# Riavvia con port forwarding locale
ssh -L 127.0.0.1:54321:localhost:54321 \
    -L 127.0.0.1:54322:localhost:54322 \
    localhost
```

---

## ✅ Verifica

Dopo aver applicato le modifiche:

```bash
# 1. Verifica che le porte siano su 127.0.0.1
netstat -an | grep LISTEN | grep -E "(54321|54322)"

# Dovrebbe mostrare:
# tcp4  0  0  127.0.0.1:54321  *.*  LISTEN  ✅
# tcp4  0  0  127.0.0.1:54322  *.*  LISTEN  ✅

# NON dovrebbe mostrare:
# tcp46 0  0  *.54321  *.*  LISTEN  ❌

# 2. Test da altro computer (dovrebbe fallire)
# Da un altro computer nella rete:
telnet <YOUR_IP> 54322
# Risultato atteso: Connection refused

# 3. Test da localhost (dovrebbe funzionare)
telnet 127.0.0.1 54322
# Risultato atteso: Connected
```

---

## 🚨 Se Non Riesci a Configurare

Se non riesci a modificare le porte, come soluzione temporanea:

### Abilita il Firewall macOS

```bash
# Abilita firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Blocca connessioni in entrata
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on

# Verifica
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

Questo blocca l'accesso esterno anche se le porte sono su `*`.

---

## 📞 Supporto

Se hai difficoltà:
1. Verifica dove sono i file di configurazione Supabase
2. Controlla i log Docker: `docker logs <container-id>`
3. Consulta: https://supabase.com/docs/guides/cli/local-development

---

**IMPORTANTE**: Fino a quando le porte non sono su 127.0.0.1, il database è accessibile da chiunque nella tua rete!
