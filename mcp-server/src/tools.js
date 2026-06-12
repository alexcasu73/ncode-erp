import { z } from 'zod';

// Parametri di lista comuni a (quasi) tutti i tool
const listParams = {
  ricerca: z.string().optional().describe('Testo da cercare nei campi principali della risorsa'),
  pagina: z.number().int().min(1).optional().describe('Numero di pagina (default 1)'),
  limite: z.number().int().min(1).max(200).optional().describe('Elementi per pagina (default 50, max 200)'),
  ordina: z.string().optional().describe('Ordinamento, formato "colonna:asc|desc" (es. "data:desc")'),
};

function buildListQuery({ ricerca, pagina, limite, ordina }, filter) {
  return {
    q: ricerca,
    page: pagina,
    limit: limite,
    sort: ordina,
    ...(filter && Object.keys(filter).length ? { filter } : {}),
  };
}

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: `❌ ${err.message || String(err)}` }] });

export function registerTools(server, api) {
  // ---------- CLIENTI ----------
  server.registerTool('lista_clienti', {
    title: 'Elenco clienti',
    description: 'Elenca i clienti della company. Supporta ricerca testuale (nome, azienda, email), filtro per stato, paginazione.',
    inputSchema: {
      ...listParams,
      stato: z.string().optional().describe('Filtra per stato cliente (es. "Attivo")'),
    },
  }, async ({ stato, ...list }) => {
    try { return ok(await api.list('customers', buildListQuery(list, { status: stato }))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_cliente', {
    title: 'Dettaglio cliente',
    description: 'Restituisce i dati completi di un singolo cliente dato il suo id.',
    inputSchema: { id: z.string().describe('ID del cliente') },
  }, async ({ id }) => {
    try { return ok(await api.get('customers', id)); } catch (e) { return fail(e); }
  });

  server.registerTool('crea_cliente', {
    title: 'Crea cliente',
    description: 'Crea un nuovo cliente. Il company_id viene impostato automaticamente dalla API key.',
    inputSchema: {
      name: z.string().describe('Nome / ragione sociale (obbligatorio)'),
      company: z.string().optional().describe('Denominazione azienda'),
      email: z.string().optional(),
      vat_id: z.string().optional().describe('Partita IVA'),
      sdi_code: z.string().optional().describe('Codice destinatario SDI'),
      address: z.string().optional(),
      phone: z.string().optional(),
      status: z.string().optional().describe('Stato (default "Attivo")'),
    },
  }, async (body) => {
    try { return ok(await api.create('customers', body)); } catch (e) { return fail(e); }
  });

  server.registerTool('aggiorna_cliente', {
    title: 'Aggiorna cliente',
    description: 'Aggiorna i campi di un cliente esistente. Passa solo i campi da modificare.',
    inputSchema: {
      id: z.string().describe('ID del cliente da aggiornare'),
      name: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      vat_id: z.string().optional(),
      sdi_code: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      status: z.string().optional(),
    },
  }, async ({ id, ...body }) => {
    try { return ok(await api.update('customers', id, body)); } catch (e) { return fail(e); }
  });

  // ---------- DEAL ----------
  server.registerTool('lista_deal', {
    title: 'Elenco deal',
    description: 'Elenca i deal/opportunità della company. Ricerca su titolo e nome cliente.',
    inputSchema: { ...listParams },
  }, async (list) => {
    try { return ok(await api.list('deals', buildListQuery(list))); } catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_deal', {
    title: 'Dettaglio deal',
    description: 'Restituisce i dati completi di un singolo deal dato il suo id.',
    inputSchema: { id: z.string().describe('ID del deal') },
  }, async ({ id }) => {
    try { return ok(await api.get('deals', id)); } catch (e) { return fail(e); }
  });

  // ---------- FATTURE ----------
  server.registerTool('lista_fatture', {
    title: 'Elenco fatture',
    description: 'Elenca le fatture (attive e passive). Filtri: tipo (Entrata/Uscita), anno, mese, stato di fatturazione. Ricerca su progetto e note.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional().describe('Entrata = fattura attiva, Uscita = passiva'),
      anno: z.number().int().optional().describe('Anno di competenza (es. 2026)'),
      mese: z.string().optional().describe('Mese in lettere come salvato (es. "Maggio")'),
      stato_fatturazione: z.string().optional().describe('Es. "Effettivo", "Previsionale"'),
    },
  }, async ({ tipo, anno, mese, stato_fatturazione, ...list }) => {
    try {
      return ok(await api.list('invoices', buildListQuery(list, {
        tipo, anno, mese, stato_fatturazione,
      })));
    } catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_fattura', {
    title: 'Dettaglio fattura',
    description: 'Restituisce i dati completi di una singola fattura dato il suo id (es. "NCO-IN-002/2025").',
    inputSchema: { id: z.string().describe('ID della fattura') },
  }, async ({ id }) => {
    try { return ok(await api.get('invoices', id)); } catch (e) { return fail(e); }
  });

  // ---------- CASHFLOW ----------
  server.registerTool('lista_cashflow', {
    title: 'Elenco movimenti di cashflow',
    description: 'Elenca i record di cashflow (entrate/uscite previste ed effettive). Ricerca su descrizione, categoria, note.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional(),
      categoria: z.string().optional().describe('Filtra per categoria'),
    },
  }, async ({ tipo, categoria, ...list }) => {
    try { return ok(await api.list('cashflow', buildListQuery(list, { tipo, categoria }))); }
    catch (e) { return fail(e); }
  });

  // ---------- TRANSAZIONI ----------
  server.registerTool('lista_transazioni', {
    title: 'Elenco transazioni',
    description: 'Elenca le transazioni generiche. Ricerca su descrizione e categoria.',
    inputSchema: { ...listParams },
  }, async (list) => {
    try { return ok(await api.list('transactions', buildListQuery(list))); } catch (e) { return fail(e); }
  });

  // ---------- MOVIMENTI BANCARI ----------
  server.registerTool('lista_movimenti_bancari', {
    title: 'Elenco movimenti bancari',
    description: 'Elenca i movimenti bancari importati (estratti conto). Ricerca su descrizione e causale.',
    inputSchema: { ...listParams },
  }, async (list) => {
    try { return ok(await api.list('bank-transactions', buildListQuery(list))); } catch (e) { return fail(e); }
  });

  // ---------- SESSIONI DI RICONCILIAZIONE ----------
  server.registerTool('lista_sessioni_riconciliazione', {
    title: 'Elenco sessioni di riconciliazione',
    description: 'Elenca le sessioni di riconciliazione bancaria. Ricerca su nome file, periodo, numero conto.',
    inputSchema: { ...listParams },
  }, async (list) => {
    try { return ok(await api.list('reconciliation-sessions', buildListQuery(list))); } catch (e) { return fail(e); }
  });
}
