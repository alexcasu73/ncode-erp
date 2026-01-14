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

  console.log(`[AI] Transaction tipo: ${transaction.tipo}, importo: €${transaction.importo}, descrizione: "${transaction.descrizione}"`);
  console.log(`[AI] Total cashflow records: ${cashflowRecords.length}, Filtered invoices: ${filteredInvoices.length}, cashflow with invoices: ${cashflowWithInvoices.length}`);

  // Log keywords from transaction description for debugging
  const transactionKeywords = (transaction.descrizione || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
  console.log(`[AI] Transaction keywords:`, transactionKeywords);

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

  // Search for Verisure specifically for debugging
  const verisureMatches = cashflowWithInvoices.filter(({ cf, invoice }) => {
    const cfNote = (cf.note || '').toLowerCase();
    const invNote = (invoice?.note || '').toLowerCase();
    return cfNote.includes('verisure') || invNote.includes('verisure');
  });
  if (verisureMatches.length > 0) {
    console.log(`[AI] 🔍 Found ${verisureMatches.length} Verisure cashflow records:`, verisureMatches.map(({ cf, invoice }) => ({
      id: cf.id,
      importo: cf.importo || ((invoice?.flusso || 0) + (invoice?.iva || 0)),
      dataPagamento: cf.dataPagamento,
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

⚠️ ATTENZIONE: L'IMPORTO È IL CRITERIO PIÙ IMPORTANTE! Se gli importi non corrispondono (differenza >2€), NON fare il match anche se le descrizioni sono simili!

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

ISTRUZIONI FONDAMENTALI:

🔴 STEP 1 - VERIFICA IMPORTO (OBBLIGATORIO):
Prima di tutto, calcola la differenza assoluta tra l'importo della transazione bancaria e l'importo di ogni movimento/fattura.
- Se la differenza è >2€, IGNORA quel movimento/fattura completamente, anche se la descrizione è identica.
- Esempio: Transazione -20€ vs Movimento 50€ = differenza 30€ → NON ABBINARE (confidence = 0)
- Esempio: Transazione -50€ vs Movimento 50€ = differenza 0€ → CONTINUARE con verifica descrizione

🟡 STEP 2 - VERIFICA DESCRIZIONE (se importo ok):
Solo se l'importo corrisponde (differenza ≤2€), controlla la descrizione:
- Fai un matching MOLTO FLESSIBILE: ignora maiuscole/minuscole, ignora caratteri speciali (*/-_.), ignora spazi
- Cerca nomi di aziende/servizi dentro la descrizione completa
- Esempi di match validi:
  * "GOOGLE*WORKSPACE" → "Google Workspace" ✅
  * "VERISURE ITALY SRL" → "Verisure" ✅
  * "DIGITAL OCEAN LLC" → "DigitalOcean" ✅
  * "ANTHROPIC PBC" → "Anthropic" ✅
- Basta che UNA PAROLA CHIAVE (>4 caratteri) sia presente in entrambe le stringhe
- NON serve match completo, basta match PARZIALE del nome azienda/servizio
- Se trovi anche solo il nome base dell'azienda (es: "Google", "Verisure"), è un match valido

🟢 STEP 3 - VERIFICA DATA (opzionale):
Se importo E descrizione matchano, controlla la vicinanza della data (±60 giorni) per aumentare ulteriormente la confidence.
IMPORTANTE: Se importo e descrizione matchano perfettamente, NON scartare il match solo perché la data è lontana!

PRIORITÀ:
1. IMPORTO (se non matcha → confidence = 0, STOP)
2. DESCRIZIONE (se importo ok ma descrizione no → confidence bassa 20-30)
3. DATA (bonus per aumentare confidence se gli altri 2 criteri matchano)

ESEMPI:
❌ BAD: Transazione "Anthropic -20€" + Movimento "Anthropic 50€" → confidence = 0 (importi diversi di 30€!)
✅ GOOD: Transazione "Anthropic -50€" + Movimento "Anthropic 50€" → confidence = 95 (importo identico + descrizione match)
✅ GOOD: Transazione "Digital Ocean -34.99€" + Movimento "Digital Ocean 34.99€" → confidence = 95
✅ GOOD: Transazione "SDD A : VERISURE ITALY SRL 2601C265808" + Movimento note "Verisure" → confidence = 90 (nome azienda presente)
✅ GOOD: Transazione "BONIF A : NCODE STUDIO SRL" + Movimento note "Ncode Studio" → confidence = 90 (match parziale nome)
✅ GOOD: Transazione "POS CARTA...GOOGLE*WORKSPACE...GOOGLE.COM" + Movimento note "Google Workspace" → confidence = 95 (match flessibile)
✅ GOOD: Transazione "ADDEBITO DIRETTO AMAZON PRIME" + Movimento note "Amazon Prime Video" → confidence = 85 (parola comune "AMAZON")

⚠️ REGOLA D'ORO: SE IMPORTO MATCHA + NOME AZIENDA/SERVIZIO PRESENTE = FAI IL MATCH!
Non essere troppo restrittivo! Se l'importo è corretto e vedi il nome dell'azienda (anche parziale, anche con caratteri speciali), è molto probabile che sia un match valido. Confidence alta (80-95%)!

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza backticks) nel seguente formato:
{"invoiceId": "id_fattura_o_null", "cashflowId": "id_cashflow_o_null", "confidence": numero_da_0_a_100, "reason": "breve spiegazione in italiano"}

IMPORTANTE:
- Usa "null" (senza virgolette) per i campi vuoti, non la stringa "null"
- Non includere testo prima o dopo il JSON
- Nel campo "reason" fai SEMPRE riferimento al MOVIMENTO DI CASSA (con il suo ID: es. "CF-xxx"), NON alla fattura
- Se confidence = 0 per differenza importo, scrivi nel reason: "Importi non corrispondenti: transazione €X vs movimento CF-YYY €Z (diff: €W)"
- Se confidence > 0, esempio reason corretto: "Match perfetto: movimento CF-0053 del 06/01/26 per €50.00 con note 'Anthropic'"
- Esempio reason ERRATO: "Match perfetto con Fattura_295"
- Il campo reason deve spiegare brevemente perché hai scelto o scartato quel MOVIMENTO DI CASSA`;

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

    // CRITICAL: Verify amount match before accepting AI suggestion
    if (result.cashflowId) {
      const matchedCashflow = cashflowRecords.find(cf => cf.id === result.cashflowId);
      if (matchedCashflow) {
        const invoice = matchedCashflow.invoiceId ? invoices.find(inv => inv.id === matchedCashflow.invoiceId) : null;
        const cashflowAmount = matchedCashflow.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
        const transactionAmount = transaction.importo;
        const amountDiff = Math.abs(cashflowAmount - transactionAmount);

        console.log(`[AI] 🔍 Verifying amount match: Transaction €${transactionAmount} vs Cashflow ${result.cashflowId} €${cashflowAmount} (diff: €${amountDiff.toFixed(2)})`);

        // If difference > 2€, REJECT the match regardless of AI confidence
        if (amountDiff > 2) {
          console.warn(`[AI] ⚠️ REJECTED: Amount difference €${amountDiff.toFixed(2)} exceeds threshold (2€). AI suggestion overridden.`);
          return {
            invoiceId: null,
            cashflowId: null,
            confidence: 0,
            reason: `❌ Match respinto: importi non corrispondenti (transazione €${transactionAmount.toFixed(2)} vs movimento €${cashflowAmount.toFixed(2)}, diff €${amountDiff.toFixed(2)})`
          };
        } else {
          console.log(`[AI] ✅ Amount verification passed (diff: €${amountDiff.toFixed(2)} ≤ 2€)`);
        }
      }
    }

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
