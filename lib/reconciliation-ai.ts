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
  cashflowRecords: CashflowRecord[]
): Promise<MatchSuggestion> {
  // Filter invoices by type (match Entrata with Entrata, Uscita with Uscita)
  const filteredInvoices = invoices.filter(inv => inv.tipo === transaction.tipo);

  // Get cashflow records with their invoices for context
  const cashflowWithInvoices = cashflowRecords.map(cf => {
    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    return { cf, invoice };
  }).filter(({ invoice }) => invoice?.tipo === transaction.tipo);

  // If no invoices match the type, return no match
  if (filteredInvoices.length === 0 && cashflowWithInvoices.length === 0) {
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
1. Cerca prima tra i movimenti di cassa già registrati - se trovi una corrispondenza esatta o molto probabile, usa il cashflowId
2. Se non c'è un movimento di cassa corrispondente, cerca tra le fatture non ancora pagate
3. Per la corrispondenza considera IN ORDINE DI IMPORTANZA:
   - **Descrizione/Note**: Confronta la descrizione della transazione bancaria con le note delle fatture e dei movimenti. Cerca parole chiave comuni, nomi di progetti, riferimenti, numeri di fattura. Questo è il criterio PIÙ IMPORTANTE.
   - **Importo**: Deve essere uguale o molto simile (tolleranza massima 1€). Se descrizione e importo matchano, confidence alta.
   - **Data**: La transazione bancaria dovrebbe essere vicina alla data fattura o data pagamento prevista (tolleranza ±30 giorni).
4. PRIORITÀ AL MATCHING SEMANTICO: Se la descrizione della transazione bancaria contiene parole chiave che matchano con le note della fattura/movimento (es. nome progetto, cliente, servizio), questo è un match molto probabile anche se le date non sono perfettamente allineate.
5. Se non trovi corrispondenze affidabili (né per descrizione né per importo), rispondi con confidence 0

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza backticks) nel seguente formato:
{"invoiceId": "id_fattura_o_null", "cashflowId": "id_cashflow_o_null", "confidence": numero_da_0_a_100, "reason": "breve spiegazione in italiano"}

IMPORTANTE:
- Usa "null" (senza virgolette) per i campi vuoti, non la stringa "null"
- Non includere testo prima o dopo il JSON
- Il campo reason deve spiegare brevemente perché hai scelto (o non scelto) questo match`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Clean potential markdown formatting
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(cleanedText);

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

  // First check cashflow records
  for (const cf of cashflowRecords) {
    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    if (!invoice || invoice.tipo !== tipo) continue;

    const cfAmount = cf.importo || ((invoice.flusso || 0) + (invoice.iva || 0));

    // Exact match on amount
    if (Math.abs(cfAmount - amount) < 0.01) {
      const hasDescMatch = hasDescriptionMatch(description, invoice.note) || hasDescriptionMatch(description, cf.note);
      return {
        invoiceId: invoice.id,
        cashflowId: cf.id,
        confidence: hasDescMatch ? 98 : 95,
        reason: hasDescMatch
          ? 'Corrispondenza esatta dell\'importo e della descrizione con movimento esistente'
          : 'Corrispondenza esatta dell\'importo con movimento di cassa esistente'
      };
    }
  }

  // Then check invoices without cashflow records
  const invoicesWithCashflow = new Set(cashflowRecords.map(cf => cf.invoiceId));

  for (const inv of invoices) {
    if (inv.tipo !== tipo) continue;
    if (invoicesWithCashflow.has(inv.id)) continue;

    const invAmount = (inv.flusso || 0) + (inv.iva || 0);

    // Exact match on amount
    if (Math.abs(invAmount - amount) < 0.01) {
      const hasDescMatch = hasDescriptionMatch(description, inv.note);
      return {
        invoiceId: inv.id,
        cashflowId: null,
        confidence: hasDescMatch ? 90 : 85,
        reason: hasDescMatch
          ? 'Corrispondenza esatta dell\'importo e della descrizione con fattura non ancora pagata'
          : 'Corrispondenza esatta dell\'importo con fattura non ancora pagata'
      };
    }
  }

  return null;
}
