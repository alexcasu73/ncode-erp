import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Invoice, CashflowRecord, BankTransaction } from '../types';

// Load AI settings from localStorage (used as cache)
// Primary source is now the database via DataContext
function getAISettings() {
  const savedSettings = localStorage.getItem('ai_settings');
  if (savedSettings) {
    try {
      return JSON.parse(savedSettings);
    } catch {
      return null;
    }
  }
  return null;
}

// Initialize Anthropic client (lazy)
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const settings = getAISettings();
    const apiKey = settings?.anthropicApiKey || import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('🔑 API Key Anthropic non configurata. Vai su Impostazioni per configurarla.');
    }

    anthropicClient = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return anthropicClient;
}

// Initialize OpenAI client (lazy)
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const settings = getAISettings();
    const apiKey = settings?.openaiApiKey;

    if (!apiKey) {
      throw new Error('🔑 API Key OpenAI non configurata. Vai su Impostazioni per configurarla.');
    }

    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return openaiClient;
}

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

  const progetto = inv.nomeProgetto ? ` | Progetto: "${inv.nomeProgetto}"` : '';
  const spesa = inv.spesa ? ` | Spesa: "${inv.spesa}"` : '';
  const note = inv.note ? ` | Note: "${inv.note}"` : '';
  return `ID: ${inv.id} | Data: ${data} | Totale: €${totale.toFixed(2)}${progetto}${spesa} | Stato: ${inv.statoFatturazione}${note}`;
}

// Format cashflow record for AI context
function formatCashflow(cf: CashflowRecord, invoice?: Invoice): string {
  const importo = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
  const progetto = invoice?.nomeProgetto || invoice?.spesa || 'N/A';
  const noteFattura = invoice?.note ? ` | Note Fattura: "${invoice.note}"` : '';
  const noteCashflow = cf.note ? ` | Note Movimento: "${cf.note}"` : '';
  const descCashflow = cf.descrizione ? ` | Desc Movimento: "${cf.descrizione}"` : '';
  const categoria = cf.categoria ? ` | Categoria: "${cf.categoria}"` : '';
  const spesa = invoice?.spesa ? ` | Spesa: "${invoice.spesa}"` : '';
  const tipoSpesa = invoice?.tipoSpesa ? ` | Tipo Spesa: "${invoice.tipoSpesa}"` : '';

  return `ID: ${cf.id} | Data Pag: ${cf.dataPagamento || 'N/D'} | Importo: €${importo.toFixed(2)} | Fattura: ${cf.invoiceId} | Progetto: ${progetto}${noteFattura}${noteCashflow}${descCashflow}${categoria}${spesa}${tipoSpesa}`;
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
  // Extract month and year from transaction date
  const transactionDate = new Date(transaction.data);
  const transactionMonth = transactionDate.getMonth(); // 0-11
  const transactionYear = transactionDate.getFullYear();

  console.log('\n' + '='.repeat(100));
  console.log('🔍 PROCESSING TRANSACTION');
  console.log('='.repeat(100));
  console.log(`📅 Data: ${transaction.data} (Mese: ${transactionMonth + 1}, Anno: ${transactionYear})`);
  console.log(`💰 Importo: €${Math.abs(transaction.importo).toFixed(2)}`);
  console.log(`📝 Tipo: ${transaction.tipo}`);
  console.log(`📋 Descrizione: "${transaction.descrizione}"`);
  console.log(`📌 Causale: "${transaction.causale || 'N/D'}"`);
  console.log('-'.repeat(100));

  // Helper function to check if date is in same month/year
  const isSameMonthYear = (dateStr: string | Date): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date.getMonth() === transactionMonth && date.getFullYear() === transactionYear;
  };

  // Filter invoices by type AND date (same month/year)
  const filteredInvoices = invoices.filter(inv =>
    inv.tipo === transaction.tipo && isSameMonthYear(inv.data)
  );

  // Get cashflow records with their invoices for context
  // Filter by tipo AND date (using ONLY cashflow date, not invoice date)
  const cashflowWithInvoices = cashflowRecords.map(cf => {
    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    return { cf, invoice };
  }).filter(({ cf, invoice }) => {
    // Check tipo
    const tipoMatches = invoice ? invoice.tipo === transaction.tipo : cf.tipo === transaction.tipo;
    if (!tipoMatches) return false;

    // Check date (same month/year) - USE ONLY CASHFLOW DATE
    // If dataPagamento is missing, include the cashflow anyway (don't filter it out)
    if (!cf.dataPagamento) {
      console.log(`⚠️ Cashflow ${cf.id} has no dataPagamento, including in results`);
      return true; // Include cashflows without date
    }
    return isSameMonthYear(cf.dataPagamento);
  });

  console.log('\n📊 STEP 1: FILTERING');
  console.log(`   Total invoices in DB: ${invoices.length}`);
  console.log(`   → Filtered by tipo (${transaction.tipo}) + date (${transactionMonth + 1}/${transactionYear}): ${filteredInvoices.length}`);
  console.log(`   Total cashflows in DB: ${cashflowRecords.length}`);
  console.log(`   → Filtered by tipo (${transaction.tipo}) + date (${transactionMonth + 1}/${transactionYear}): ${cashflowWithInvoices.length}`);

  // Log all cashflows being sent to AI with their dates
  console.log('\n📋 CASHFLOWS AVAILABLE FOR MATCHING:');
  if (cashflowWithInvoices.length === 0) {
    console.log('   ❌ NESSUN FLUSSO DI CASSA DISPONIBILE!');
  } else {
    cashflowWithInvoices.forEach(({ cf, invoice }) => {
      const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
      const diff = Math.abs(cfAmount - Math.abs(transaction.importo));
      const withinTolerance = diff <= 2.0;

      console.log(`   ${withinTolerance ? '✅' : '❌'} ${cf.id} | €${cfAmount.toFixed(2)} (diff: €${diff.toFixed(2)}) | ${cf.dataPagamento || 'NO DATE'}`);
      console.log(`      Note: "${cf.note || 'N/D'}" | Spesa: "${invoice?.spesa || 'N/D'}" | Categoria: "${cf.categoria || 'N/D'}"`);
    });
  }

  // Check for exact amount match in cashflows
  const exactAmountMatches = cashflowWithInvoices.filter(({ cf, invoice }) => {
    const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
    const diff = Math.abs(cfAmount - Math.abs(transaction.importo));
    return diff <= 0.10;
  });
  if (exactAmountMatches.length > 0) {
    console.log(`[AI] 🎯 Found ${exactAmountMatches.length} cashflow(s) with matching amount (±€0.10):`, exactAmountMatches.map(({ cf, invoice }) => ({
      id: cf.id,
      invoiceId: cf.invoiceId,
      importo: cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0),
      note: cf.note,
      descMovimento: cf.descrizione,
      noteFattura: invoice?.note,
      progetto: invoice?.nomeProgetto,
      spesa: invoice?.spesa
    })));
  } else {
    console.log(`[AI] ⚠️ NO cashflow found with matching amount €${Math.abs(transaction.importo)}. Available amounts:`,
      cashflowWithInvoices.slice(0, 10).map(({ cf, invoice }) => ({
        id: cf.id,
        amount: cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0)
      }))
    );
  }

  // Check for ALL cashflows with amounts within ±1€ tolerance
  const amountTolerance1Euro = cashflowWithInvoices.filter(({ cf, invoice }) => {
    const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
    const diff = Math.abs(cfAmount - Math.abs(transaction.importo));
    return diff <= 1.00;
  });
  if (amountTolerance1Euro.length > 0) {
    console.log(`[AI] 📊 Found ${amountTolerance1Euro.length} cashflow(s) within ±€1 tolerance:`, amountTolerance1Euro.map(({ cf, invoice }) => ({
      id: cf.id,
      invoiceId: cf.invoiceId,
      importo: cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0),
      diff: Math.abs((cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0)) - Math.abs(transaction.importo)).toFixed(2),
      note: cf.note,
      categoria: cf.categoria,
      descrizione: cf.descrizione,
      spesa: invoice?.spesa
    })));
  }

  // Check if we have old-style IDs (long timestamp format) - this indicates cache issue
  const hasOldStyleIds = cashflowRecords.some(cf => cf.id.includes('-') && cf.id.split('-').length === 3 && cf.id.split('-')[1].length > 5);
  if (hasOldStyleIds) {
    console.warn(`[AI] ⚠️ WARNING: Detected old-style cashflow IDs! Please RELOAD the page (F5) to get new progressive IDs from database.`);
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

  const prompt = `CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no backticks, no additional text.

Sei un assistente per la riconciliazione bancaria. Trova il MOVIMENTO DI CASSA che corrisponde alla transazione bancaria.

TRANSAZIONE BANCARIA DA RICONCILIARE:
${formatBankTransaction(transaction)}

MOVIMENTI DI CASSA DISPONIBILI (già filtrati per tipo ${transaction.tipo} e mese/anno):
${cashflowWithInvoices.length > 0
      ? cashflowWithInvoices.map(({ cf, invoice }) => formatCashflow(cf, invoice)).join('\n')
      : 'Nessun movimento registrato'}

ALGORITMO DI RICONCILIAZIONE (segui ESATTAMENTE questi step):

STEP 1 - FILTRA PER IMPORTO (OBBLIGATORIO - NON SALTARE):
- I movimenti sono già filtrati per tipo (${transaction.tipo}) e mese/anno
- CRITICAL: Per OGNI movimento, DEVI calcolare: differenza = |importo_transazione - importo_movimento|
- Se differenza > 2€ → ❌ ESCLUDI IMMEDIATAMENTE quel movimento, NON considerarlo, passa al successivo
- Se differenza ≤ 2€ → ✅ CONTINUA con STEP 2

IMPORTANTE: NON puoi scegliere un movimento solo perché la descrizione matcha.
L'importo DEVE essere compatibile (≤2€ differenza) PRIMA di verificare la descrizione.

Esempio SBAGLIATO:
- Transazione: €10.00 "ANTHROPIC"
- Movimento CF-0114: €50.00 Note: "Anthropic"
- ❌ SBAGLIATO: {"cashflowId": "CF-0114", "confidence": 95, "reason": "Match perfetto"}
- ✅ CORRETTO: Escludere CF-0114 perché differenza €40 > €2

Esempio CORRETTO:
- Transazione: €10.00 "ANTHROPIC"
- Movimento CF-0053: €10.50 Note: "Anthropic"
- ✅ CORRETTO: {"cashflowId": "CF-0053", "confidence": 95, "reason": "Match: CF-0053 per €10.50 - 'Anthropic' trovato"}

STEP 2 - VERIFICA DESCRIZIONE:
- Prendi la DESCRIZIONE della transazione (campo "Descrizione:")
- Estrai le parole chiave significative (ignora articoli, preposizioni, caratteri speciali)
- Confronta con TUTTI questi campi del movimento e della fattura collegata:
  * Note Movimento (campo "Note Movimento:")
  * Descrizione Movimento (campo "Desc Movimento:")
  * Note Fattura (campo "Note Fattura:")
  * Spesa (campo "Spesa:" - dalla fattura collegata)
  * Tipo Spesa (campo "Tipo Spesa:" - dalla fattura collegata)
  * Categoria (campo "Categoria:")

- Matching FLESSIBILE: ignora maiuscole/minuscole, punteggiatura, caratteri speciali
- Cerca parole chiave comuni o concetti simili
- Esempi di match validi:
  * "ANTHROPIC +14152360599" vs Note Fattura: "Anthropic" → ✅ MATCH
  * "VERISURE ITALY SRL" vs Spesa: "Verisure" → ✅ MATCH
  * "GOOGLE WORKSPACE" vs Note Movimento: "Google" → ✅ MATCH
  * "Paypal servizi online" vs Tipo Spesa: "Costi per servizi" → ✅ MATCH

DECISIONE FINALE:

✅ SE IMPORTO OK (≤2€) E DESCRIZIONE MATCHA:
   → confidence = 90-95%
   → cashflowId = [ID del movimento]
   → reason = "Match: movimento [ID] per €[importo] - [breve spiegazione]"
   → RICONCILIA AUTOMATICAMENTE

⚠️ SE IMPORTO OK (≤2€) MA DESCRIZIONE NON MATCHA:
   → confidence = 40-60% (in base a quanto è vicino l'importo)
   → cashflowId = [ID del movimento con importo più vicino]
   → reason = "Importo compatibile (€[X]) ma descrizione non corrisponde - verifica manuale"
   → MOSTRA ALL'UTENTE PER VERIFICA

❌ SE NESSUN MOVIMENTO CON IMPORTO ≤2€:
   → confidence = 0
   → cashflowId = null, invoiceId = null
   → reason = "Nessun movimento con importo compatibile (€[X]) trovato"

FORMATO RISPOSTA OBBLIGATORIO:
IMPORTANT: Your response must be ONLY the JSON object below. Do not write any text before or after the JSON.
Do not use markdown code blocks. Do not add explanations. Just the raw JSON object.

CRITICAL:
- "cashflowId" must be the EXACT ID from the cashflow (e.g., "CF-0289", never format it differently)
- "invoiceId" must be the EXACT ID from "Fattura:" field (e.g., "Fattura_90", never use formatted numbers like "90/2026")
- If no match, both IDs must be null

{"invoiceId": null, "cashflowId": "CF-XXX o null", "confidence": numero_0_100, "reason": "spiegazione breve in italiano"}

ESEMPI DI RISPOSTE VALIDE (copia questo formato esatto):

✅ Transazione: "ANTHROPIC +14152360599" €10.00 del 02/01/2026
   Movimento: ID: CF-0053 | Fattura: Fattura_114 | €10.00 Note: "Anthropic"
   → {"invoiceId": "Fattura_114", "cashflowId": "CF-0053", "confidence": 95, "reason": "Match perfetto: CF-0053 per €10.00 - 'Anthropic' trovato in note"}

⚠️ Transazione: "PAGAMENTO POS" €67.08 del 02/01/2026
   Movimento: ID: CF-0123 | Fattura: Fattura_89 | €67.08 Note: "Verisure"
   → {"invoiceId": "Fattura_89", "cashflowId": "CF-0123", "confidence": 60, "reason": "Importo compatibile (€67.08) ma descrizione generica - verifica manuale"}

❌ Transazione: "Commissioni bancarie" €0.59 del 02/01/2026
   Movimenti disponibili: €10.00, €17.08, €50.00
   → {"invoiceId": null, "cashflowId": null, "confidence": 0, "reason": "Nessun movimento con importo compatibile (€0.59) trovato"}`;

  try {
    const selectedModel = model || 'claude-3-5-haiku-20241022';
    console.log('\n🤖 STEP 2: CALLING AI');
    console.log(`   Model: ${selectedModel}`);
    console.log(`   Sending ${cashflowWithInvoices.length} cashflows for analysis...`);

    let text = '';

    // Determine provider based on model name
    if (selectedModel.startsWith('gpt-')) {
      // OpenAI models
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: selectedModel,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      text = response.choices[0]?.message?.content || '';
    } else {
      // Anthropic models (claude-*)
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 500,
        system: 'You are a precise JSON generator for bank reconciliation. CRITICAL RULES: 1) You MUST respond with ONLY valid JSON (no text, no markdown, no backticks). 2) You MUST filter by amount FIRST (difference ≤ 2€) BEFORE checking description. NEVER select a cashflow just because the description matches if the amount difference is > 2€. Your entire response must be a single valid JSON object starting with { and ending with }.',
        messages: [{ role: 'user', content: prompt }]
      });
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    }

    // Clean potential markdown formatting and extract JSON
    let cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // If response doesn't start with {, try to extract JSON from the text
    if (!cleanedText.startsWith('{')) {
      console.warn('[AI] Response does not start with {, attempting to extract JSON...');
      console.warn('[AI] Raw response:', text.substring(0, 200));

      // Try to find JSON object in the response
      const jsonMatch = text.match(/\{[^]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
        console.log('[AI] Extracted JSON from response:', cleanedText.substring(0, 100));
      } else {
        throw new Error(`AI response is not valid JSON. Response starts with: "${text.substring(0, 50)}..."`);
      }
    }

    const result = JSON.parse(cleanedText);

    console.log('\n🎯 STEP 3: AI RESPONSE');
    console.log(`   Raw JSON: ${cleanedText}`);
    console.log(`   ├─ cashflowId: ${result.cashflowId || 'null'}`);
    console.log(`   ├─ invoiceId: ${result.invoiceId || 'null'}`);
    console.log(`   ├─ confidence: ${result.confidence}%`);
    console.log(`   └─ reason: "${result.reason}"`);

    // CRITICAL: Verify amount match before accepting AI suggestion
    console.log('\n✅ STEP 4: VERIFICATION');
    if (result.cashflowId) {
      const matchedCashflow = cashflowRecords.find(cf => cf.id === result.cashflowId);
      if (matchedCashflow) {
        const invoice = matchedCashflow.invoiceId ? invoices.find(inv => inv.id === matchedCashflow.invoiceId) : null;
        const cashflowAmount = matchedCashflow.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
        const transactionAmount = Math.abs(transaction.importo);
        const amountDiff = Math.abs(cashflowAmount - transactionAmount);

        console.log(`   Checking amount: €${transactionAmount.toFixed(2)} (transaction) vs €${cashflowAmount.toFixed(2)} (${result.cashflowId})`);
        console.log(`   Difference: €${amountDiff.toFixed(2)}`);

        // If difference > 2€, REJECT the match regardless of AI confidence
        if (amountDiff > 2) {
          console.log(`   ❌ REJECTED: Difference exceeds 2€ threshold`);
          console.log('\n' + '='.repeat(100));
          console.log(`📍 FINAL RESULT: NO MATCH (amount mismatch)`);
          console.log('='.repeat(100) + '\n');
          return {
            invoiceId: null,
            cashflowId: null,
            confidence: 0,
            reason: `❌ Match respinto: importi non corrispondenti (transazione €${transactionAmount.toFixed(2)} vs movimento €${cashflowAmount.toFixed(2)}, diff €${amountDiff.toFixed(2)})`
          };
        } else {
          console.log(`   ✅ APPROVED: Difference within tolerance (≤2€)`);
        }

        // CRITICAL: Always use the invoiceId from the cashflow, not from AI response
        // The AI sometimes returns formatted IDs like "90/2026" instead of "Fattura_90"
        if (matchedCashflow.invoiceId) {
          console.log(`   🔄 Correcting invoiceId: AI returned "${result.invoiceId}" but using cashflow's invoiceId "${matchedCashflow.invoiceId}"`);
          result.invoiceId = matchedCashflow.invoiceId;
        }
      }
    } else {
      console.log(`   No cashflow ID to verify`);
    }

    const finalResult = {
      invoiceId: result.invoiceId || null,
      cashflowId: result.cashflowId || null,
      confidence: Math.min(100, Math.max(0, Number(result.confidence) || 0)),
      reason: result.reason || 'Analisi completata'
    };

    console.log('\n' + '='.repeat(100));
    if (finalResult.cashflowId) {
      console.log(`✅ FINAL RESULT: MATCHED with ${finalResult.cashflowId} (confidence: ${finalResult.confidence}%)`);
    } else {
      console.log(`❌ FINAL RESULT: NO MATCH (confidence: ${finalResult.confidence}%)`);
    }
    console.log(`   Reason: "${finalResult.reason}"`);
    console.log('='.repeat(100) + '\n');

    return finalResult;
  } catch (error) {
    console.error('Error in AI matching:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    // Provide specific error messages based on error type
    let errorMessage = 'Errore sconosciuto';
    let isFatalError = false;

    // Check for Anthropic SDK error structure
    if (error && typeof error === 'object') {
      const err = error as any;

      // Check error.status for HTTP status codes
      const status = err.status || err.statusCode;

      // Check error.type for Anthropic error types
      const errorType = err.type || err.error?.type;

      // Get the message from various possible locations
      const message = (err.message || err.error?.message || '').toLowerCase();
      const fullError = JSON.stringify(error).toLowerCase();

      console.log(`[AI Error] Status: ${status}, Type: ${errorType}, Message: ${message}`);

      // 401 - Authentication error (FATAL)
      if (status === 401 || message.includes('unauthorized') || message.includes('authentication') ||
        message.includes('api key') || message.includes('apikey') || errorType === 'authentication_error') {
        errorMessage = '🔑 Chiave API di Claude mancante o non valida. Verifica la configurazione in .env';
        isFatalError = true;
      }
      // 402 - Payment required / Credits insufficient (FATAL)
      else if (status === 402 || message.includes('payment') || message.includes('credit') ||
        message.includes('insufficient') || fullError.includes('credit') ||
        fullError.includes('402') || errorType === 'payment_required') {
        errorMessage = '💳 CREDITI CLAUDE INSUFFICIENTI! Ricarica il tuo account Anthropic su console.anthropic.com/settings/billing';
        isFatalError = true;
      }
      // 429 - Rate limiting
      else if (status === 429 || message.includes('rate limit') || message.includes('too many requests') ||
        errorType === 'rate_limit_error') {
        errorMessage = '⏱️ Limite di richieste API raggiunto. Attendi qualche minuto prima di riprovare';
      }
      // 403 - Permission denied / Quota exceeded (FATAL)
      else if (status === 403 || message.includes('quota') || message.includes('billing') ||
        message.includes('permission') || errorType === 'permission_error') {
        errorMessage = '⛔ Quota API superata o permessi insufficienti. Verifica il tuo account Anthropic';
        isFatalError = true;
      }
      // 500/502/503 - Server errors
      else if (status >= 500 || message.includes('server error') || message.includes('503') ||
        message.includes('502') || errorType === 'api_error') {
        errorMessage = '🔧 Servizio Claude temporaneamente non disponibile. Riprova tra qualche minuto';
      }
      // Network errors
      else if (message.includes('network') || message.includes('fetch') || message.includes('connection') ||
        message.includes('econnrefused') || message.includes('enotfound')) {
        errorMessage = '🌐 Errore di connessione. Verifica la tua connessione internet e riprova';
      }
      // JSON parsing errors
      else if (message.includes('json') || message.includes('parse') || message.includes('unexpected token')) {
        errorMessage = '📝 Errore nel formato della risposta AI. Il modello potrebbe essere sovraccarico, riprova';
      }
      // Model not found
      else if (status === 404 || message.includes('model') || message.includes('not found') ||
        errorType === 'not_found_error') {
        errorMessage = '🤖 Modello AI non disponibile. Prova con un modello diverso';
      }
      // Timeout
      else if (message.includes('timeout') || message.includes('timed out') || message.includes('deadline')) {
        errorMessage = '⏲️ Timeout della richiesta AI. Riprova tra qualche secondo';
      }
      // Generic error with message
      else if (message) {
        errorMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
      }
    }

    // For fatal errors, throw the exception so it can be caught by the caller
    if (isFatalError) {
      const fatalError = new Error(errorMessage);
      (fatalError as any).isFatal = true;
      throw fatalError;
    }

    // For non-fatal errors, return a result with confidence 0
    return {
      invoiceId: null,
      cashflowId: null,
      confidence: 0,
      reason: `Errore nell'analisi AI: ${errorMessage}`
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
