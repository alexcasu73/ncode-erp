# Database Setup - Settings Table

## Come creare la tabella Settings in Supabase

Per salvare le API keys in modo permanente nel database, devi eseguire lo script SQL fornito.

### Passaggi:

1. **Accedi a Supabase Dashboard**
   - Vai su https://supabase.com/dashboard
   - Seleziona il tuo progetto

2. **Apri SQL Editor**
   - Nel menu laterale, clicca su "SQL Editor"
   - Oppure vai su: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/sql

3. **Crea una nuova query**
   - Clicca su "+ New query"

4. **Copia e incolla lo script**
   - Apri il file `create_settings_table.sql`
   - Copia tutto il contenuto
   - Incollalo nell'editor SQL di Supabase

5. **Esegui lo script**
   - Clicca sul pulsante "Run" (o premi Ctrl+Enter / Cmd+Enter)
   - Dovresti vedere il messaggio "Success. No rows returned"

6. **Verifica la creazione**
   - Nel menu laterale, vai su "Table Editor"
   - Dovresti vedere la nuova tabella "settings" con una riga di default

### Struttura della tabella

La tabella `settings` contiene:
- `id` (TEXT): Sempre "default" - una sola riga
- `default_ai_provider` (TEXT): "anthropic" o "openai"
- `anthropic_api_key` (TEXT): API key di Anthropic Claude
- `openai_api_key` (TEXT): API key di OpenAI
- `updated_at` (TIMESTAMP): Data ultimo aggiornamento (automatico)

### Note sulla sicurezza

- Le API keys sono salvate nel database Supabase (PostgreSQL)
- Assicurati che il tuo database Supabase sia protetto
- Le Row Level Security (RLS) policies sono abilitate
- Solo utenti autenticati possono accedere alla tabella (modifica le policy secondo le tue esigenze)

### Backup

Se vuoi fare backup delle tue API keys:
```sql
SELECT * FROM settings WHERE id = 'default';
```

### Ripristino

Per ripristinare o aggiornare manualmente:
```sql
UPDATE settings
SET
  anthropic_api_key = 'la-tua-chiave',
  openai_api_key = 'la-tua-chiave'
WHERE id = 'default';
```
