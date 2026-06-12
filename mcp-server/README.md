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

## Configurazione

Copia `.env.example` in `.env` e imposta:

| Variabile | Descrizione |
|-----------|-------------|
| `MCP_PORT` | Porta del server MCP (default 3003) |
| `API_BASE_URL` | URL della REST API ERP (es. `http://127.0.0.1:3002`) |
| `API_KEY` | API key `ncode_...` con cui interrogare la REST API |
| `MCP_AUTH_TOKEN` | (opzionale) bearer token per proteggere `/mcp`. In produzione **impostalo**. |

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

Scrittura: `crea_cliente`, `aggiorna_cliente`.

Tutti i tool di lista accettano `ricerca`, `pagina`, `limite`, `ordina` più filtri specifici.

## Collegare un client (es. claude.ai / Claude Code)

Aggiungi un MCP server remoto con URL `https://<host>/mcp` e, se configurato,
header `Authorization: Bearer <MCP_AUTH_TOKEN>`.
