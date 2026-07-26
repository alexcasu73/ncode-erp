# ncode-erp-mcp

MCP server (trasporto **Streamable HTTP**, remoto) che espone i dati dell'ERP tramite **tool curati**, appoggiandosi alla REST API `api-server` (`/api/v1`).

## Architettura

```
Client MCP (Claude / claude.ai / Claude Code)
        │  JSON-RPC su HTTP  (POST /mcp)
        ▼
  mcp-server  ──X-API-Key──►  api-server (/api/v1)  ──service role──►  Supabase
```

Il MCP non parla direttamente col DB: usa la REST API con una **API key** (`X-API-Key`), quindi i dati visibili sono quelli della company a cui appartiene la chiave.

**Multi-tenant:** non c'è una chiave fissa. Ogni client si autentica con la API key
della propria azienda nel bearer (`Authorization: Bearer <ncode_...>`), generata da
**Impostazioni → API Keys** nell'app. Il MCP la inoltra come `X-API-Key`: ogni azienda
vede solo i propri dati.

## Configurazione

Copia `.env.example` in `.env` e imposta:

| Variabile | Descrizione |
|-----------|-------------|
| `MCP_PORT` | Porta del server MCP (default 3003) |
| `API_BASE_URL` | URL della REST API ERP (es. `http://127.0.0.1:3002`) |

La API key **non** si configura qui: arriva per-richiesta dal bearer del client.

## Avvio

```bash
npm install
npm start         # oppure: npm run dev (watch)
```

Endpoint MCP: `POST http://<host>:<MCP_PORT>/mcp` · Health: `GET /health`

## Tool disponibili

Lettura: `lista_clienti`, `dettaglio_cliente`, `lista_deal`, `dettaglio_deal`,
`lista_fatture`, `dettaglio_fattura`, `lista_cashflow`, `lista_transazioni`,
`lista_movimenti_bancari`, `lista_sessioni_riconciliazione`.

Scrittura: `crea_cliente`, `aggiorna_cliente`, `crea_fattura`, `aggiorna_fattura`,
`elimina_fattura`, `crea_cashflow`, `aggiorna_cashflow`, `elimina_cashflow`.

Tutti i tool di lista accettano `ricerca`, `pagina`, `limite`, `ordina` più filtri specifici.

## Collegare un client (es. claude.ai / Claude Code)

Aggiungi un MCP server remoto con URL `https://<host>/mcp` e, se configurato,
header `Authorization: Bearer <MCP_AUTH_TOKEN>`.
