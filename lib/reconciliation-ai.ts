import Anthropic from '@anthropic-ai/sdk';
import type { Invoice, CashflowRecord, BankTransaction } from '../types';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export interface MatchSuggestion {
  invoiceId: string | null;
  cashflowId: string | null;
  confidence: number; // 0-100
  reason: string;
}

// Format invoice for AI context
function formatInvoice(inv: Invoice): string {
  const totale = (inv.flusso || 0) + (inv.iva || 0);
  const data = inv.data instanceof Date
    ? inv.data.toISOString().split('T')[0]
    : inv.data;

  const note = inv.note ? ` | Note: "${inv.note}"` : '';
  return `ID: ${inv.id} | Data: ${data} | Totale: €${totale.toFixed(2)} | Progetto: ${inv.nomeProgetto || inv.spesa || 'N/A'} | Stato: ${inv.statoFatturazione}${note}`;
}

// Format cashflow record for AI context
function formatCashflow(cf: CashflowRecord, invoice?: Invoice): string {
  const importo = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
  const progetto = invoice?.nomeProgetto || invoice?.spesa || 'N/A';
  const noteFattura = invoice?.note ? ` | Note Fattura: "${invoice.note}"` : '';
  const noteCashflow = cf.note ? ` | Note Movimento: "${cf.note}"` : '';

  return `ID: ${cf.id} | Data Pag: ${cf.dataPagamento || 'N/D'} | Importo: €${importo.toFixed(2)} | Fattura: ${cf.invoiceId} | Progetto: ${progetto}${noteFattura}${noteCashflow}`;
}

// Format bank transaction for AI context
function formatBankTransaction(tx: BankTransaction): string {
  return `Data: ${tx.data} | Importo: €${tx.importo.toFixed(2)} | Tipo: ${tx.tipo} | Causale: ${tx.causale || 'N/D'} | Descrizione: "${tx.descrizione}"`;
}

// Suggest match for a single transaction
export async function suggestMatch(
  transaction: BankTransaction,
  invoices: Invoice[],
  cashflowRecords: CashflowRecord[],
  model?: string
): Promise<MatchSuggestion> {
  // Filter invoices by type (match Entrata with Entrata, Uscita with Uscita)
  const filteredInvoices = invoices.filter(inv => inv.tipo === transaction.tipo);

  // Get cashflow records with their invoices for context
  // Include both cashflow with invoices AND standalone cashflow that match tipo
  const cashflowWithInvoices = cashflowRecords.map(cf => {
    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    return { cf, invoice };
  }).filter(({ cf, invoice }) => {
    // Include if invoice matches tipo OR if it's standalone with matching tipo
    if (invoice) {
      return invoice.tipo === transaction.tipo;
    } else {
      return cf.tipo === transaction.tipo;
    }
  });

  console.log(`[AI] Transaction tipo: ${transaction.tipo}, descrizione: "${transaction.descrizione}"`);
  console.log(`[AI] Total cashflow records: ${cashflowRecords.length}, Filtered invoices: ${filteredInvoices.length}, cashflow with invoices: ${cashflowWithInvoices.length}`);

  // Check if we have old-style IDs (long timestamp format) - this indicates cache issue
  const hasOldStyleIds = cashflowRecords.some(cf => cf.id.includes('-') && cf.id.split('-').length === 3 && cf.id.split('-')[1].length > 5);
  if (hasOldStyleIds) {
    console.warn(`[AI] ⚠️ WARNING: Detected old-style cashflow IDs! Please RELOAD the page (F5) to get new progressive IDs from database.`);
  }

  // Log some cashflow samples to debug
  if (cashflowWithInvoices.length > 0) {
    console.log(`[AI] Sample cashflow:`, cashflowWithInvoices.slice(0, 2).map(({ cf, invoice }) => ({
      id: cf.id,
      invoiceId: cf.invoiceId,
      importo: cf.importo,
      tipo: cf.tipo || invoice?.tipo,
      note: cf.note || invoice?.note
    })));
  }

  // If no invoices match the type, return no match
  if (filteredInvoices.length === 0 && cashflowWithInvoices.length === 0) {
    console.log(`[AI] No matching records found for tipo ${transaction.tipo}`);
    return {
      invoiceId: null,
      cashflowId: null,
      confidence: 0,
      reason: `Nessuna ${transaction.tipo === 'Entrata' ? 'fattura di entrata' : 'fattura di uscita'} trovata nel sistema.`
    };
  }

  const prompt = `Sei un assistente esperto in contabilità per la riconciliazione bancaria di una piccola azienda italiana. Analizza questa transazione bancaria e trova il miglior abbinamento tra le fatture e i movimenti di cassa disponibili.

TRANSAZIONE BANCARIA DA RICONCILIARE:
${formatBankTransaction(transaction)}

FATTURE DISPONIBILI (tipo: ${transaction.tipo}):
${filteredInvoices.length > 0
  ? filteredInvoices.map(inv => formatInvoice(inv)).join('\n')
  : 'Nessuna fattura disponibile'}

MOVIMENTI DI CASSA GIÀ REGISTRATI (tipo: ${transaction.tipo}):
${cashflowWithInvoices.length > 0
  ? cashflowWithInvoices.map(({ cf, invoice }) => formatCashflow(cf, invoice)).join('\n')
  : 'Nessun movimento registrato'}

ISTRUZIONI:
1. Cerca SEMPRE tra i movimenti di cassa già registrati - se trovi una corrispondenza esatta o molto probabile, usa il cashflowId
2. Se non c'è un movimento di cassa corrispondente, cerca tra le fatture non ancora pagate
3. Per la corrispondenza considera IN ORDINE DI IMPORTANZA:
   - **Importo**: CRITERIO FONDAMENTALE - Gli importi devono corrispondere con tolleranza massima di 2€. Se l'importo non corrisponde, NON creare l'abbinamento (confidence = 0).
   - **Descrizione/Note**: Confronta la descrizione della transazione bancaria con le note dei movimenti di cassa. Cerca parole chiave comuni, nomi di progetti, riferimenti.
   - **Data**: La transazione bancaria dovrebbe essere vicina alla data pagamento del movimento (tolleranza ±30 giorni).
4. REGOLA FONDAMENTALE: Se l'importo della transazione è significativamente diverso (differenza >2€), NON abbinare anche se la descrizione sembra corrispondere. In quel caso rispondi con confidence 0.
5. Solo se IMPORTO + DESCRIZIONE matchano, allora considera anche la data per aumentare la confidence.
6. Se non trovi corrispondenze affidabili (importo + descrizione), rispondi con confidence 0

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza backticks) nel seguente formato:
{"invoiceId": "id_fattura_o_null", "cashflowId": "id_cashflow_o_null", "confidence": numero_da_0_a_100, "reason": "breve spiegazione in italiano"}

IMPORTANTE:
- Usa "null" (senza virgolette) per i campi vuoti, non la stringa "null"
- Non includere testo prima o dopo il JSON
- Nel campo "reason" fai SEMPRE riferimento al MOVIMENTO DI CASSA (con il suo ID: es. "CF-xxx"), NON alla fattura
- Esempio reason corretto: "Match perfetto: movimento CF-123456 del 06/01/26 per €50.00 con note 'Anthropic'"
- Esempio reason ERRATO: "Match perfetto con Fattura_295"
- Il campo reason deve spiegare brevemente perché hai scelto quel MOVIMENTO DI CASSA`;

  try {
    const selectedModel = model || 'claude-3-5-haiku-20241022';
    console.log(`[AI] 🤖 Using model: ${selectedModel}`);
    console.log(`[AI] Sending prompt (first 1000 chars):`, prompt.substring(0, 1000) + '...');

    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`[AI] Raw response:`, text);

    // Clean potential markdown formatting
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(cleanedText);
    console.log(`[AI] Parsed result:`, result);

    return {
      invoiceId: result.invoiceId || null,
      cashflowId: result.cashflowId || null,
      confidence: Math.min(100, Math.max(0, Number(result.confidence) || 0)),
      reason: result.reason || 'Analisi completata'
    };
  } catch (error) {
    console.error('Error in AI matching:', error);
    return {
      invoiceId: null,
      cashflowId: null,
      confidence: 0,
      reason: `Errore nell'analisi AI: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    };
  }
}

// Batch process multiple transactions
export async function suggestMatchesBatch(
  transactions: BankTransaction[],
  invoices: Invoice[],
  cashflowRecords: CashflowRecord[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, MatchSuggestion>> {
  const results = new Map<string, MatchSuggestion>();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    // Skip already matched or ignored transactions
    if (tx.matchStatus === 'matched' || tx.matchStatus === 'ignored') {
      continue;
    }

    const suggestion = await suggestMatch(tx, invoices, cashflowRecords);
    results.set(tx.id, suggestion);

    if (onProgress) {
      onProgress(i + 1, transactions.length);
    }

    // Small delay to avoid rate limiting
    if (i < transactions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

// Helper to check if description matches notes
function hasDescriptionMatch(description: string, notes: string | undefined): boolean {
  if (!notes || !description) return false;

  const descLower = description.toLowerCase();
  const notesLower = notes.toLowerCase();

  // Extract significant words (longer than 3 chars)
  const descWords = descLower.split(/\s+/).filter(w => w.length > 3);
  const notesWords = notesLower.split(/\s+/).filter(w => w.length > 3);

  // Check if any significant word appears in both
  return descWords.some(dw => notesWords.some(nw => nw.includes(dw) || dw.includes(nw)));
}

// Quick match without AI (exact amount match + optional description match)
export function quickMatch(
  transaction: BankTransaction,
  invoices: Invoice[],
  cashflowRecords: CashflowRecord[]
): MatchSuggestion | null {
  const amount = transaction.importo;
  const tipo = transaction.tipo;
  const description = transaction.descrizione || '';
  const txDate = new Date(transaction.data);

  // Match cashflow records by amount
  const matchingCashflows = cashflowRecords.filter(cf => {
    // Get the invoice to check tipo
    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    if (!invoice || invoice.tipo !== tipo) return false;

    // Check amount match
    const cfAmount = cf.importo || ((invoice.flusso || 0) + (invoice.iva || 0));
    return Math.abs(cfAmount - amount) < 0.01;
  });

  // If no cashflow matches, return null
  if (matchingCashflows.length === 0) {
    return null;
  }

  // If multiple matches with same amount, try to disambiguate by description
  if (matchingCashflows.length > 1) {
    const descMatches = matchingCashflows.filter(cf => {
      // Check if description matches cashflow note or invoice note
      const invoice = invoices.find(inv => inv.id === cf.invoiceId);
      return hasDescriptionMatch(description, cf.note) ||
             (invoice && hasDescriptionMatch(description, invoice.note));
    });

    // If only one has description match, use it
    if (descMatches.length === 1) {
      const cf = descMatches[0];
      const invoice = invoices.find(inv => inv.id === cf.invoiceId);
      return {
        invoiceId: invoice?.id || null,
        cashflowId: cf.id,
        confidence: 95,
        reason: 'Corrispondenza esatta di importo e descrizione'
      };
    }

    // Try to match by date proximity (within 7 days of payment date)
    const dateMatches = matchingCashflows.filter(cf => {
      if (!cf.dataPagamento) return false;
      const cfDate = new Date(cf.dataPagamento);
      const diffDays = Math.abs((txDate.getTime() - cfDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });

    if (dateMatches.length === 1) {
      const cf = dateMatches[0];
      const invoice = invoices.find(inv => inv.id === cf.invoiceId);
      return {
        invoiceId: invoice?.id || null,
        cashflowId: cf.id,
        confidence: 85,
        reason: 'Corrispondenza di importo e data pagamento vicina'
      };
    }

    // Multiple ambiguous matches - don't auto-match
    return null;
  }

  // Single cashflow match found
  const matchedCashflow = matchingCashflows[0];
  const matchedInvoice = invoices.find(inv => inv.id === matchedCashflow.invoiceId);

  // Check description match
  const hasDescMatch = hasDescriptionMatch(description, matchedCashflow.note) ||
                       (matchedInvoice && hasDescriptionMatch(description, matchedInvoice.note));

  // Check date proximity with payment date
  let isDateClose = false;
  if (matchedCashflow.dataPagamento) {
    const cfDate = new Date(matchedCashflow.dataPagamento);
    const diffDays = Math.abs((txDate.getTime() - cfDate.getTime()) / (1000 * 60 * 60 * 24));
    isDateClose = diffDays <= 30;
  }

  let confidence = 80;
  let reason = 'Corrispondenza esatta dell\'importo';

  if (hasDescMatch && isDateClose) {
    confidence = 95;
    reason = 'Corrispondenza esatta di importo, descrizione e data';
  } else if (hasDescMatch) {
    confidence = 90;
    reason = 'Corrispondenza esatta di importo e descrizione';
  } else if (isDateClose) {
    confidence = 85;
    reason = 'Corrispondenza esatta di importo e data vicina';
  }

  return {
    invoiceId: matchedInvoice?.id || null,
    cashflowId: matchedCashflow.id,
    confidence,
    reason
  };
}
