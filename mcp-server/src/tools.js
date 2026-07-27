import { z } from 'zod';

// ── Struttura risposta lista ────────────────────────────────────────────────
// Tutti i tool di lista restituiscono: { data: [...], meta: { total, page, limit, pages } }
// - meta.total  = numero totale di record che corrispondono alla query
// - meta.pages  = numero totale di pagine (ceil(total / limit))
// - meta.page   = pagina corrente, meta.limit = elementi per pagina
// Se meta.pages > 1 ci sono altre pagine: passa pagina=N per vederle.
// Default: pagina=1, limite=50 (max 200).

const PAGINATION_NOTE = 'Restituisce { data: [...], meta: { total, page, limit, pages } }. ' +
  'Se meta.pages > 1 ci sono altri risultati: usa pagina=N per vederli. Default limite=50.';

const listParams = {
  ricerca: z.string().optional().describe('Testo da cercare (case-insensitive) nei campi principali della risorsa'),
  pagina: z.number().int().min(1).optional().describe('Numero di pagina, default 1. Se meta.pages > 1, usa questo per le pagine successive.'),
  limite: z.number().int().min(1).max(200).optional().describe('Elementi per pagina (default 50, max 200). Aumenta per ottenere più risultati in una sola chiamata.'),
  ordina: z.string().optional().describe('Ordinamento, formato "colonna:asc" o "colonna:desc" (es. "data:desc", "name:asc")'),
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

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function meseAnnoDaData(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data || '');
  if (!m) return {};
  return { anno: parseInt(m[1], 10), mese: MESI[parseInt(m[2], 10) - 1] };
}

export function registerTools(server, api) {
  // ═════════════════════════════════════════════════════════════════════════════
  //  CLIENTI
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_clienti', {
    title: 'Elenco clienti',
    description: 'Elenca i clienti della company. ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, name (nome), company (ragione sociale), email, status (Attivo/Prospetto/Inattivo), ' +
      'revenue (fatturato), vat_id (P.IVA), sdi_code (codice SDI), address, phone, ' +
      'contact_person (persona di contatto), pec, legal_representative (rappresentante legale). ' +
      'Ricerca su: name, company, email. Ordinamento default: name (asc).',
    inputSchema: {
      ...listParams,
      stato: z.string().optional().describe('Filtra per status: "Attivo", "Prospetto" o "Inattivo"'),
    },
  }, async ({ stato, ...list }) => {
    try { return ok(await api.list('customers', buildListQuery(list, { status: stato }))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_cliente', {
    title: 'Dettaglio cliente',
    description: 'Restituisce tutti i dati di un singolo cliente dato il suo id. ' +
      ' Inclusi i campi aggiuntivi: contact_person, pec, legal_representative.',
    inputSchema: { id: z.string().describe('ID del cliente (es. ottenuto da lista_clienti)') },
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
      address: z.string().optional().describe('Indirizzo / sede'),
      phone: z.string().optional().describe('Telefono'),
      status: z.string().optional().describe('Stato: "Attivo" (default), "Prospetto" o "Inattivo"'),
      contact_person: z.string().optional().describe('Persona di contatto'),
      pec: z.string().optional().describe('Indirizzo PEC'),
      legal_representative: z.string().optional().describe('Rappresentante legale'),
      revenue: z.number().optional().describe('Fatturato del cliente (default 0)'),
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
      status: z.string().optional().describe('"Attivo", "Prospetto" o "Inattivo"'),
      contact_person: z.string().optional(),
      pec: z.string().optional(),
      legal_representative: z.string().optional(),
      revenue: z.number().optional(),
    },
  }, async ({ id, ...body }) => {
    try { return ok(await api.update('customers', id, body)); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  DEAL / OPPORTUNITÀ
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_deal', {
    title: 'Elenco deal',
    description: 'Elenca i deal/opportunità commerciali della company. ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, title (titolo deal), customer_name (nome cliente), value (valore in euro), ' +
      'stage (stadio pipeline: "Lead", "Qualificato", "Proposta", "Negoziazione", "Vinto", "Perso"), ' +
      'probability (% di chiusura), expected_close (data chiusura prevista). ' +
      'Ricerca su: title, customer_name. Ordinamento default: created_at (desc).',
    inputSchema: {
      ...listParams,
      stage: z.string().optional().describe('Filtra per stadio: "Lead", "Qualificato", "Proposta", "Negoziazione", "Vinto", "Perso"'),
    },
  }, async ({ stage, ...list }) => {
    try { return ok(await api.list('deals', buildListQuery(list, stage ? { stage } : {}))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_deal', {
    title: 'Dettaglio deal',
    description: 'Restituisce i dati completi di un singolo deal dato il suo id.',
    inputSchema: { id: z.string().describe('ID del deal') },
  }, async ({ id }) => {
    try { return ok(await api.get('deals', id)); } catch (e) { return fail(e); }
  });

  server.registerTool('crea_deal', {
    title: 'Crea deal',
    description: 'Crea una nuova opportunità commerciale (deal). Il company_id viene impostato automaticamente.',
    inputSchema: {
      title: z.string().describe('Titolo del deal (obbligatorio)'),
      customer_name: z.string().optional().describe('Nome del cliente'),
      value: z.number().optional().describe('Valore stimato in euro (default 0)'),
      stage: z.string().optional().describe('Stadio: "Lead", "Qualificato", "Proposta", "Negoziazione", "Vinto", "Perso"'),
      probability: z.number().int().min(0).max(100).optional().describe('% probabilità di chiusura (0-100)'),
      expected_close: z.string().optional().describe('Data chiusura prevista (YYYY-MM-DD o testo libero)'),
    },
  }, async (body) => {
    try { return ok(await api.create('deals', body)); } catch (e) { return fail(e); }
  });

  server.registerTool('aggiorna_deal', {
    title: 'Aggiorna deal',
    description: 'Aggiorna un deal esistente. Passa solo i campi da modificare. Utile per cambiare stage o probability.',
    inputSchema: {
      id: z.string().describe('ID del deal'),
      title: z.string().optional(),
      customer_name: z.string().optional(),
      value: z.number().optional(),
      stage: z.string().optional().describe('"Lead", "Qualificato", "Proposta", "Negoziazione", "Vinto", "Perso"'),
      probability: z.number().int().min(0).max(100).optional(),
      expected_close: z.string().optional(),
    },
  }, async ({ id, ...body }) => {
    try { return ok(await api.update('deals', id, body)); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  FATTURE
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_fatture', {
    title: 'Elenco fatture',
    description: 'Elenca le fatture (attive = Entrata e passive = Uscita). ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, data (YYYY-MM-DD), mese (es. "Maggio"), anno (es. 2026), ' +
      'nome_progetto (descrizione/progetto), tipo ("Entrata" o "Uscita"), ' +
      'stato_fatturazione ("Effettivo", "Previsionale" o "Nessuno"), ' +
      'flusso (importo imponibile in euro), iva (importo IVA in euro), percentuale_iva (es. 22), ' +
      'spesa (categoria spesa, per le passive: "Tools", "Utenze", "Affitto", ecc.), ' +
      'tipo_spesa ("Costi per servizi", "Altri costi", "Team"), ' +
      'data_scadenza (data scadenza pagamento), percentuale_fatturazione, note, checked. ' +
      'Ricerca su: nome_progetto, note, tipo. Ordinamento default: data (desc). ' +
      'NOTA: ci sono centinaia di fatture — usa sempre anno, mese, tipo o limite alto per non perdere record.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional().describe('Entrata = fattura attiva (vendita), Uscita = passiva (acquisto)'),
      anno: z.number().int().optional().describe('Anno di competenza (es. 2026)'),
      mese: z.string().optional().describe('Mese in lettere come salvato: "Gennaio", "Febbraio", ecc.'),
      stato_fatturazione: z.string().optional().describe('"Effettivo", "Previsionale" o "Nessuno"'),
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
    description: 'Restituisce tutti i dati di una singola fattura dato il suo id (es. "NCO-IN-002/2025").',
    inputSchema: { id: z.string().describe('ID della fattura') },
  }, async ({ id }) => {
    try { return ok(await api.get('invoices', id)); } catch (e) { return fail(e); }
  });

  server.registerTool('crea_fattura', {
    title: 'Crea fattura',
    description: 'Crea una nuova fattura (attiva = Entrata, passiva = Uscita). L\'id viene generato automaticamente. ' +
      'mese/anno sono derivati dalla data se non indicati.',
    inputSchema: {
      tipo: z.enum(['Entrata', 'Uscita']).describe('Entrata = fattura attiva (vendita), Uscita = passiva (acquisto)'),
      data: z.string().describe('Data della fattura in formato YYYY-MM-DD'),
      flusso: z.number().describe('Importo imponibile in euro (senza IVA)'),
      nome_progetto: z.string().optional().describe('Nome progetto / descrizione fattura'),
      iva: z.number().optional().describe('Importo IVA in euro (default 0)'),
      percentuale_iva: z.number().optional().describe('Aliquota IVA come numero (es. 22 per 22%, default 0)'),
      stato_fatturazione: z.string().optional().describe('"Effettivo", "Previsionale" o "Nessuno"'),
      spesa: z.string().optional().describe('Categoria spesa (per le passive): "Tools", "Utenze", "Affitto", "Banca", "Commercialista", "Marketing", "Intrattenimento", "Generiche"'),
      tipo_spesa: z.string().optional().describe('"Costi per servizi", "Altri costi", "Team"'),
      note: z.string().optional(),
      data_scadenza: z.string().optional().describe('Data scadenza pagamento YYYY-MM-DD'),
      percentuale_fatturazione: z.number().optional().describe('Percentuale di fatturazione (default 100)'),
    },
  }, async ({ data, ...rest }) => {
    try {
      const body = { data, ...meseAnnoDaData(data), ...rest };
      return ok(await api.create('invoices', body));
    } catch (e) { return fail(e); }
  });

  server.registerTool('aggiorna_fattura', {
    title: 'Aggiorna fattura',
    description: 'Aggiorna una fattura esistente. Passa solo i campi da modificare. Se cambi la data, mese/anno vengono riallineati.',
    inputSchema: {
      id: z.string().describe('ID della fattura da aggiornare'),
      tipo: z.enum(['Entrata', 'Uscita']).optional(),
      data: z.string().optional().describe('Data YYYY-MM-DD'),
      flusso: z.number().optional().describe('Importo imponibile in euro'),
      nome_progetto: z.string().optional(),
      iva: z.number().optional(),
      percentuale_iva: z.number().optional(),
      stato_fatturazione: z.string().optional(),
      spesa: z.string().optional(),
      tipo_spesa: z.string().optional(),
      note: z.string().optional(),
      data_scadenza: z.string().optional(),
      percentuale_fatturazione: z.number().optional(),
    },
  }, async ({ id, data, ...rest }) => {
    try {
      const body = { ...(data ? { data, ...meseAnnoDaData(data) } : {}), ...rest };
      return ok(await api.update('invoices', id, body));
    } catch (e) { return fail(e); }
  });

  server.registerTool('elimina_fattura', {
    title: 'Elimina fattura',
    description: 'Elimina definitivamente una fattura dato il suo id. Operazione irreversibile.',
    inputSchema: { id: z.string().describe('ID della fattura da eliminare') },
  }, async ({ id }) => {
    try { await api.remove('invoices', id); return ok({ deleted: true, id }); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  CASHFLOW (movimenti di cassa)
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_cashflow', {
    title: 'Elenco movimenti di cashflow',
    description: 'Elenca i record di cashflow (entrate/uscite previste ed effettive). ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, tipo ("Entrata" o "Uscita"), importo (euro), ' +
      'data_pagamento (YYYY-MM-DD), descrizione, categoria, note, ' +
      'stato_fatturazione ("Effettivo", "Stimato" o "Nessuno"), invoice_id (ID fattura collegata, opzionale). ' +
      'Ricerca su: descrizione, categoria, note. ' +
      'NOTA: ci sono centinaia di record — usa sempre tipo, categoria o limite alto.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional(),
      categoria: z.string().optional().describe('Filtra per categoria'),
      stato_fatturazione: z.string().optional().describe('"Effettivo", "Stimato" o "Nessuno"'),
    },
  }, async ({ tipo, categoria, stato_fatturazione, ...list }) => {
    try { return ok(await api.list('cashflow', buildListQuery(list, { tipo, categoria, stato_fatturazione }))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_cashflow', {
    title: 'Dettaglio movimento di cashflow',
    description: 'Restituisce i dati completi di un singolo movimento di cashflow dato il suo id.',
    inputSchema: { id: z.string().describe('ID del movimento') },
  }, async ({ id }) => {
    try { return ok(await api.get('cashflow', id)); } catch (e) { return fail(e); }
  });

  server.registerTool('crea_cashflow', {
    title: 'Crea movimento di cashflow',
    description: 'Crea un nuovo movimento di cashflow (entrata o uscita previsionale/effettiva). L\'id viene generato automaticamente.',
    inputSchema: {
      tipo: z.enum(['Entrata', 'Uscita']).describe('Entrata o Uscita'),
      importo: z.number().describe('Importo del movimento in euro'),
      data_pagamento: z.string().optional().describe('Data del pagamento in formato YYYY-MM-DD'),
      descrizione: z.string().optional().describe('Descrizione del movimento'),
      categoria: z.string().optional().describe('Categoria (es. "Vendite", "Affitto", "Software")'),
      note: z.string().optional(),
      stato_fatturazione: z.string().optional().describe('"Effettivo", "Stimato" o "Nessuno"'),
      invoice_id: z.string().optional().describe('ID di una fattura collegata (opzionale)'),
    },
  }, async (body) => {
    try { return ok(await api.create('cashflow', body)); } catch (e) { return fail(e); }
  });

  server.registerTool('aggiorna_cashflow', {
    title: 'Aggiorna movimento di cashflow',
    description: 'Aggiorna un movimento di cashflow esistente. Passa solo i campi da modificare.',
    inputSchema: {
      id: z.string().describe('ID del movimento da aggiornare'),
      tipo: z.enum(['Entrata', 'Uscita']).optional(),
      importo: z.number().optional(),
      data_pagamento: z.string().optional().describe('Data YYYY-MM-DD'),
      descrizione: z.string().optional(),
      categoria: z.string().optional(),
      note: z.string().optional(),
      stato_fatturazione: z.string().optional(),
      invoice_id: z.string().optional(),
    },
  }, async ({ id, ...body }) => {
    try { return ok(await api.update('cashflow', id, body)); } catch (e) { return fail(e); }
  });

  server.registerTool('elimina_cashflow', {
    title: 'Elimina movimento di cashflow',
    description: 'Elimina definitivamente un movimento di cashflow dato il suo id. Operazione irreversibile.',
    inputSchema: { id: z.string().describe('ID del movimento da eliminare') },
  }, async ({ id }) => {
    try { await api.remove('cashflow', id); return ok({ deleted: true, id }); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  TRANSAZIONI GENERICHE
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_transazioni', {
    title: 'Elenco transazioni',
    description: 'Elenca le transazioni generiche registrate. ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, date (YYYY-MM-DD), description, category, amount (euro), ' +
      'type ("Entrata" o "Uscita"), status ("Completato" o "In Attesa"). ' +
      'Ricerca su: description, category.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional().describe('Filtra per tipo'),
      stato: z.string().optional().describe('"Completato" o "In Attesa"'),
      categoria: z.string().optional().describe('Filtra per categoria'),
    },
  }, async ({ tipo, stato, categoria, ...list }) => {
    try { return ok(await api.list('transactions', buildListQuery(list, { type: tipo, status: stato, category: categoria }))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_transazione', {
    title: 'Dettaglio transazione',
    description: 'Restituisce i dati completi di una singola transazione dato il suo id.',
    inputSchema: { id: z.string().describe('ID della transazione') },
  }, async ({ id }) => {
    try { return ok(await api.get('transactions', id)); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  MOVIMENTI BANCARI (estratti conto)
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_movimenti_bancari', {
    title: 'Elenco movimenti bancari',
    description: 'Elenca i movimenti bancari importati dagli estratti conto. ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, session_id (ID sessione di riconciliazione), ' +
      'data (data operazione YYYY-MM-DD), data_valuta, causale, descrizione, ' +
      'importo (euro: positivo = entrata, negativo = uscita), tipo ("Entrata" o "Uscita"), ' +
      'saldo (saldo progressivo dopo il movimento), ' +
      'match_status ("pending" = da riconciliare, "matched" = riconciliato, "ignored" = ignorato, "manual" = manuale), ' +
      'matched_invoice_id (ID fattura riconciliata), matched_cashflow_id (ID cashflow riconciliato), ' +
      'match_confidence (% affidabilità match), match_reason (spiegazione del match). ' +
      'Ricerca su: descrizione, causale. ' +
      'NOTA: ci sono centinaia di movimenti — usa sempre session_id o match_status per filtrare.',
    inputSchema: {
      ...listParams,
      tipo: z.enum(['Entrata', 'Uscita']).optional(),
      match_status: z.string().optional().describe('"pending" = da riconciliare, "matched" = riconciliato, "ignored" = ignorato, "manual" = manuale'),
      session_id: z.string().optional().describe('Filtra per sessione di riconciliazione'),
    },
  }, async ({ tipo, match_status, session_id, ...list }) => {
    try { return ok(await api.list('bank-transactions', buildListQuery(list, { tipo, match_status, session_id }))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_movimento_bancario', {
    title: 'Dettaglio movimento bancario',
    description: 'Restituisce i dati completi di un singolo movimento bancario dato il suo id, ' +
      'inclusi i dettagli del match di riconciliazione (matched_invoice_id, match_confidence, match_reason).',
    inputSchema: { id: z.string().describe('ID del movimento bancario') },
  }, async ({ id }) => {
    try { return ok(await api.get('bank-transactions', id)); } catch (e) { return fail(e); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  SESSIONI DI RICONCILIAZIONE
  // ═════════════════════════════════════════════════════════════════════════════
  server.registerTool('lista_sessioni_riconciliazione', {
    title: 'Elenco sessioni di riconciliazione',
    description: 'Elenca le sessioni di riconciliazione bancaria. ' + PAGINATION_NOTE + ' ' +
      'Campi restituiti: id, file_name (nome file estratto conto), upload_date, ' +
      'periodo (es. "Gennaio 2025"), periodo_dal, periodo_al (date inizio/fine periodo YYYY-MM-DD), ' +
      'numero_conto, saldo_iniziale (euro), saldo_finale (euro), ' +
      'total_transactions (numero totale movimenti), matched_count (riconciliati), ' +
      'pending_count (da riconciliare), ignored_count (ignorati), ' +
      'status ("open" = aperta, "closed" = chiusa), closed_date. ' +
      'Ricerca su: file_name, periodo, numero_conto. Ordinamento default: created_at (desc).',
    inputSchema: {
      ...listParams,
      status: z.string().optional().describe('"open" = sessione aperta, "closed" = chiusa'),
    },
  }, async ({ status, ...list }) => {
    try { return ok(await api.list('reconciliation-sessions', buildListQuery(list, status ? { status } : {}))); }
    catch (e) { return fail(e); }
  });

  server.registerTool('dettaglio_sessione_riconciliazione', {
    title: 'Dettaglio sessione di riconciliazione',
    description: 'Restituisce i dati completi di una singola sessione di riconciliazione dato il suo id, ' +
      'inclusi i conteggi (matched_count, pending_count, etc.) e i saldi.',
    inputSchema: { id: z.string().describe('ID della sessione') },
  }, async ({ id }) => {
    try { return ok(await api.get('reconciliation-sessions', id)); } catch (e) { return fail(e); }
  });
}