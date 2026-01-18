# Deploy della Edge Function per l'invio Email

La funzionalità di invio email utilizza una Supabase Edge Function che deve essere deployata per funzionare.

## Opzione 1: Deploy su Supabase Cloud (Consigliato per Produzione)

1. **Link al progetto Supabase**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

   Puoi trovare il `project-ref` nel dashboard di Supabase → Settings → General → Reference ID

2. **Deploy della Edge Function**
   ```bash
   supabase functions deploy send-email
   ```

3. **Verifica il deploy**
   - Vai su Supabase Dashboard → Edge Functions
   - Dovresti vedere `send-email` nella lista
   - Testa l'invio email dalle impostazioni dell'app

## Opzione 2: Test Locale (Solo per Sviluppo)

Per testare localmente, devi avviare il server delle Edge Functions:

```bash
cd supabase
supabase functions serve --no-verify-jwt
```

**Nota**: Questo comando deve rimanere in esecuzione mentre testi l'app. Premi `Ctrl+C` per fermarlo.

## Risoluzione Problemi

### "Edge Function returned a non-2xx status code"
- La Edge Function non è deployata o non è raggiungibile
- **Soluzione**: Esegui `supabase functions deploy send-email`

### "FunctionsRelayError" o errori di rete
- Il server locale delle Edge Functions non è in esecuzione
- **Soluzione**: Avvia `supabase functions serve` in un terminale separato

### Errori durante il deploy
- Verifica di aver fatto login: `supabase login`
- Verifica di aver linkato il progetto: `supabase link --project-ref <your-ref>`

## Come Funziona

La Edge Function `send-email` supporta due provider:

1. **SMTP Tradizionale**: Usa qualsiasi server SMTP (Gmail, Outlook, ecc.)
2. **Google OAuth2**: Usa l'API Gmail con OAuth2 (consigliato per Gmail)

La funzione gestisce:
- Autenticazione con Google OAuth2 e refresh token
- Invio tramite Gmail API o SMTP
- Formattazione email HTML e testo
- Gestione errori e logging

## Sicurezza

Le credenziali email (password SMTP, refresh token OAuth2) sono:
- Salvate nel database Supabase
- Accessibili solo agli utenti autenticati della company
- Protette da Row Level Security (RLS)
- Trasmesse alla Edge Function solo quando necessario
