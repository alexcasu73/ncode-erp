# 🚀 Ncode ERP - Backend Express

Questo progetto ora include un **backend Express** per gestire l'invio email e altre operazioni server-side.

## 📁 Struttura del Progetto

```
ncode-erp/
├── server/                 # Backend Express (NUOVO!)
│   ├── src/
│   │   ├── index.js       # Server principale
│   │   ├── email/         # Servizio email (nodemailer + Gmail API)
│   │   ├── db/            # Connessione database PostgreSQL
│   │   └── middleware/    # Middleware Express
│   ├── .env               # Configurazione backend
│   └── package.json       # Dipendenze backend
│
├── src/                   # Frontend React + Vite
├── components/            # Componenti React
└── lib/                   # Librerie condivise
```

## 🎯 Cosa Fa il Backend

Il backend Express gestisce:

- ✅ **Invio email** via SMTP o Google OAuth2
- ✅ **Inviti utenti** con email personalizzate
- ✅ **Test configurazione email**
- ✅ Connessione diretta a PostgreSQL (Supabase)

## 🚦 Avvio Rapido

### Opzione 1: Avvio Manuale (2 terminali)

**Terminale 1 - Frontend:**
```bash
npm run dev
```

**Terminale 2 - Backend:**
```bash
npm run dev:server
```

### Opzione 2: Avvio Automatico (1 terminale)

```bash
npm run dev:all
```

Questo avvia **frontend e backend contemporaneamente** in un unico terminale.

## 🔧 Configurazione

### 1. Backend (.env file già configurato)

Il file `server/.env` è già configurato per l'ambiente locale:

```env
SERVER_PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### 2. Frontend (.env file già configurato)

Il file `.env` principale include ora l'URL del backend:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_API_URL=http://localhost:3001/api
```

## 📧 Configurazione Email

La configurazione email viene gestita tramite l'interfaccia UI:

1. Vai su **Impostazioni** nell'app
2. Scorri fino a **"Provider Email per Inviti"**
3. Scegli tra **SMTP** o **Google OAuth2**
4. Compila i campi richiesti
5. Clicca **"Salva Impostazioni"**
6. Testa con il pulsante **"Invia Test"**

### Provider Supportati

#### 🔹 SMTP Tradizionale
- Gmail (con App Password)
- Outlook / Office 365
- Altri provider SMTP

#### 🔹 Google OAuth2 (Consigliato per Gmail)
- Usa l'API Gmail ufficiale
- Refresh token che non scade mai
- Migliore deliverability

## 🧪 Test Email

Per testare la configurazione email:

1. Configura il provider in **Impostazioni**
2. Clicca **"Salva Impostazioni"**
3. Inserisci un'email di test
4. Clicca **"Invia Test"**

Dovresti ricevere un'email di invito di esempio.

## 🔍 Verifica Stato Servizi

### Backend
```bash
curl http://localhost:3001/api/health
```

Risposta attesa:
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T...",
  "service": "ncode-erp-server"
}
```

### Frontend
Apri il browser su: http://localhost:5173

### Database (Supabase)
```bash
supabase status
```

## 📝 API Endpoints

### GET /api/health
Controlla lo stato del server

### POST /api/email/send-invitation
Invia email di invito a un nuovo utente

**Body:**
```json
{
  "companyId": "uuid",
  "toEmail": "user@example.com",
  "toName": "Nome Utente",
  "inviterName": "Admin",
  "companyName": "Ncode Studio",
  "inviteToken": "token-123",
  "role": "user"
}
```

### POST /api/email/test
Testa la configurazione email

**Body:**
```json
{
  "companyId": "uuid",
  "testEmail": "test@example.com"
}
```

## 🛠️ Sviluppo

### Struttura Backend

```
server/src/
├── index.js              # Server Express principale
├── email/
│   └── email.service.js  # Servizio email (nodemailer + googleapis)
├── db/
│   └── pool.js           # Connessione PostgreSQL
└── middleware/
    └── errorHandler.js   # Gestione errori
```

### Dipendenze Backend

- **express**: Server HTTP
- **nodemailer**: Invio email SMTP
- **googleapis**: Gmail API OAuth2
- **pg**: Client PostgreSQL
- **cors**: Cross-Origin Resource Sharing
- **helmet**: Security headers

## 🐛 Risoluzione Problemi

### Backend non si avvia
```bash
# Verifica che la porta 3001 sia libera
lsof -i :3001

# Se occupata, uccidi il processo
kill -9 <PID>
```

### Frontend non comunica con Backend
1. Verifica che il backend sia in esecuzione su porta 3001
2. Controlla che `.env` contenga: `VITE_API_URL=http://localhost:3001/api`
3. Riavvia il frontend: `npm run dev`

### Email non vengono inviate
1. Verifica la configurazione in **Impostazioni**
2. Testa con **"Invia Test"**
3. Controlla i log del backend: `tail -f /tmp/ncode-backend.log`

### Database non raggiungibile
```bash
# Verifica che Supabase sia in esecuzione
supabase status

# Se non attivo, avvialo
supabase start
```

## 📦 Produzione

### Build Frontend
```bash
npm run build
```

### Avvio Backend (Produzione)
```bash
cd server
NODE_ENV=production npm start
```

### Variabili d'Ambiente Produzione

Aggiorna questi valori per produzione:

**server/.env:**
```env
SERVER_PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
DATABASE_URL=postgresql://user:pass@host:port/database
```

## 🔄 Migrazione dalla Versione Serverless

Questa versione sostituisce le **Supabase Edge Functions** con un **backend Express tradizionale**.

### Differenze

| Aspetto | Serverless (Prima) | Backend Express (Ora) |
|---------|-------------------|----------------------|
| Architettura | Edge Functions (Deno) | Server Express (Node.js) |
| Deploy | Supabase Cloud | VPS/Cloud tradizionale |
| Email | Edge Function | Backend API |
| Manutenzione | Gestito da Supabase | Gestito da te |
| Costi | Pay-per-invocation | Server fisso |

### Vantaggi Backend Express

- ✅ **Più controllo**: Gestisci tutto il codice server
- ✅ **Più semplice**: Stesso pattern di OKR Manager
- ✅ **Debugging facile**: Log diretti, no Edge Function
- ✅ **Sviluppo locale**: Tutto in locale, no deploy

## 📞 Supporto

Per problemi o domande:
1. Controlla i log: `tail -f /tmp/ncode-backend.log`
2. Verifica stato servizi: `npm run dev:all`
3. Controlla documentazione completa in questo file

---

**Versione**: 2.0.0-backend-express
**Data**: 2026-01-19
