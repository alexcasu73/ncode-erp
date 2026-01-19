# 🔄 Istruzioni di Rollback

Questo documento spiega come tornare alla versione serverless (senza backend Express) se necessario.

## 📍 Punto di Backup

- **Tag Git**: `v1.0-serverless-backup`
- **Branch Main**: commit `9871e5d` (19 Gen 2026)
- **Data backup**: 2026-01-19 08:28:00

## 🔙 Opzione 1: Tornare al Branch Main (Consigliato)

Se stai lavorando sul branch `feature/express-backend` e vuoi tornare alla versione stabile:

```bash
# Salva eventuali modifiche non committate (opzionale)
git stash

# Torna al branch main
git checkout main

# Se vuoi cancellare il branch feature
git branch -D feature/express-backend
```

## 🏷️ Opzione 2: Usare il Tag di Backup

Se hai fatto merge del branch e vuoi tornare indietro:

```bash
# Crea un nuovo branch dal tag di backup
git checkout -b rollback-to-serverless v1.0-serverless-backup

# Forza il main a tornare al tag
git checkout main
git reset --hard v1.0-serverless-backup
git push origin main --force
```

## 📦 Opzione 3: Scaricare il Backup da GitHub

Vai su GitHub e scarica la release:
- https://github.com/alexcasu73/ncode-erp/releases/tag/v1.0-serverless-backup

## ✅ Cosa Includeva la Versione Serverless

La versione di backup (v1.0-serverless-backup) include:

### Funzionalità Complete
- ✅ Dashboard con statistiche
- ✅ Gestione fatture e cashflow
- ✅ Riconciliazione bancaria con AI
- ✅ Multi-tenancy (companies + users)
- ✅ Gestione clienti e opportunità
- ✅ Import/Export unificato Excel
- ✅ Notifiche scadenze fatture
- ✅ Autenticazione completa
- ✅ Profili utente con avatar
- ✅ User management (CRUD utenti)

### Architettura
- React + Vite (frontend)
- Supabase (database PostgreSQL)
- Supabase Auth (autenticazione)
- Row Level Security (RLS) per multi-tenant
- Nessun backend separato

### Email (Non Funzionante)
- ⚠️ Edge Function creata ma non deployata
- Configurazione email presente in UI
- Richiede: `supabase functions deploy send-email`

## 🆕 Cosa Aggiungerà il Backend Express

Il branch `feature/express-backend` aggiungerà:

- Backend Express separato (porta 3001)
- Invio email funzionante (nodemailer + googleapis)
- Gestione inviti utenti via email
- API REST per comunicazione frontend-backend
- Stesso approccio di OKR Manager

## 🚨 In Caso di Problemi

Se qualcosa va storto con il backend Express:

1. **Torna al main**:
   ```bash
   git checkout main
   ```

2. **Verifica che tutto funzioni**:
   ```bash
   npm install
   npm run dev
   ```

3. **Controlla Supabase**:
   ```bash
   supabase status
   ```

4. **Se necessario, riavvia Supabase**:
   ```bash
   supabase stop
   supabase start
   ```

## 📞 Supporto

Se hai dubbi o problemi con il rollback, contatta il team di sviluppo.

---

**Nota**: Questo documento verrà rimosso una volta che il backend Express sarà stabile e testato.
