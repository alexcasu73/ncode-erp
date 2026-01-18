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

// Initialize Anthropic client (always fresh to pick up updated keys)
function getAnthropicClient(): Anthropic {
  const settings = getAISettings();

  // SECURITY: Only use API key from database/localStorage
  // NEVER use import.meta.env.VITE_* as it exposes keys in the client bundle!
  const apiKey = settings?.anthropicApiKey;

  if (!apiKey) {
    throw new Error('🔑 API Key Anthropic non configurata. Vai su Impostazioni per configurarla.');
  }

  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true  // ⚠️ Still a risk - consider using backend proxy
  });
}

// Initialize OpenAI client (always fresh to pick up updated keys)
function getOpenAIClient(): OpenAI {
  const settings = getAISettings();
  const apiKey = settings?.openaiApiKey;

  if (!apiKey) {
    throw new Error('🔑 API Key OpenAI non configurata. Vai su Impostazioni per configurarla.');
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });
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

  // CRITICAL: Filter cashflows by EXACT amount BEFORE sending to AI
  // This prevents AI from selecting cashflows with wrong amounts - imports MUST be IDENTICAL
  const transactionAmount = Math.abs(transaction.importo);
  const cashflowsWithinTolerance = cashflowWithInvoices.filter(({ cf, invoice }) => {
    const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
    return cfAmount === transactionAmount; // ZERO tolerance - must be EXACTLY equal
  });

  console.log(`   → Filtered by EXACT amount (ZERO tolerance): ${cashflowsWithinTolerance.length}`);

  // STEP 2: FILTER cashflows by checking if their notes appear in transaction description
  const description = (transaction.descrizione || '').toLowerCase();

  console.log(`\n🔍 STEP 2: DESCRIPTION MATCHING`);
  console.log(`   Transaction description: "${transaction.descrizione}"`);

  let cashflowsMatchingService = cashflowsWithinTolerance;
  if (description) {
    cashflowsMatchingService = cashflowsWithinTolerance.filter(({ cf, invoice }) => {
      // Extract significant words from cashflow notes (>3 chars, alphabetic)
      const noteMovimento = (cf.note || '').toLowerCase();
      const noteFattura = (invoice?.note || '').toLowerCase();

      const allNotes = [noteMovimento, noteFattura].filter(Boolean).join(' ');

      // Extract words from notes (>3 chars, only alphabetic)
      const noteWords = allNotes
        .split(/[\s*]+/)
        .filter(w => w.length > 3 && /^[a-z]+$/i.test(w));

      if (noteWords.length === 0) {
        console.log(`   ⚠️ ${cf.id}: No significant words in notes`);
        return false;
      }

      // Check if ANY word from notes appears in transaction description
      for (const word of noteWords) {
        if (description.includes(word)) {
          console.log(`   ✅ ${cf.id}: Word "${word}" from notes found in transaction description`);
          return true;
        }
      }

      console.log(`   ❌ ${cf.id}: No words from notes [${noteWords.join(', ')}] found in transaction`);
      return false;
    });

    console.log(`   → Cashflows with matching descriptions: ${cashflowsMatchingService.length}`);

    // If NO cashflows match, return immediately with confidence=0%
    if (cashflowsMatchingService.length === 0) {
      const availableServices = cashflowsWithinTolerance
        .map(({ cf, invoice }) => {
          const noteMovimento = cf.note || '';
          const noteFattura = invoice?.note || '';
          return noteMovimento || noteFattura || '(nessuna nota)';
        })
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .slice(0, 3)
        .join(', ');

      console.log(`\n❌ NO MATCH: Nessuna nota dei movimenti trovata nella descrizione della transazione`);
      console.log(`   Servizi disponibili nei movimenti da €${transactionAmount.toFixed(2)}: ${availableServices}`);
      console.log('\n' + '='.repeat(100));
      console.log(`❌ FINAL RESULT: NO MATCH (description mismatch)`);
      console.log('='.repeat(100) + '\n');

      return {
        invoiceId: null,
        cashflowId: null,
        confidence: 0,
        reason: `Nessuna corrispondenza trovata (movimenti disponibili: ${availableServices})`
      };
    }
  }

  // Use the filtered cashflows for the rest of the process
  const cashflowsToSendToAI = cashflowsMatchingService;

  // Log all cashflows being sent to AI with their dates
  console.log('\n📋 CASHFLOWS AVAILABLE FOR MATCHING (after all filters):');
  if (cashflowsToSendToAI.length === 0) {
    console.log('   ❌ NESSUN FLUSSO DI CASSA DISPONIBILE DOPO I FILTRI!');
  } else {
    cashflowsToSendToAI.forEach(({ cf, invoice }) => {
      const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);

      console.log(`   ✅ ${cf.id} | €${cfAmount.toFixed(2)} (EXACT MATCH) | ${cf.dataPagamento || 'NO DATE'}`);
      console.log(`      Note: "${cf.note || 'N/D'}" | Spesa: "${invoice?.spesa || 'N/D'}" | Categoria: "${cf.categoria || 'N/D'}"`);
    });
  }

  // Log excluded cashflows for debugging
  const excludedCashflows = cashflowWithInvoices.filter(({ cf, invoice }) => {
    const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
    return cfAmount !== transactionAmount;
  });

  if (excludedCashflows.length > 0) {
    console.log('\n🚫 CASHFLOWS EXCLUDED (amount not exactly equal):');
    excludedCashflows.slice(0, 5).forEach(({ cf, invoice }) => {
      const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
      const diff = Math.abs(cfAmount - transactionAmount);
      console.log(`   ❌ ${cf.id} | €${cfAmount.toFixed(2)} (diff: €${diff.toFixed(2)}) | Note: "${cf.note || 'N/D'}"`);
    });
    if (excludedCashflows.length > 5) {
      console.log(`   ... and ${excludedCashflows.length - 5} more excluded`);
    }
  }

  // All cashflows in cashflowsToSendToAI have EXACT amount match AND service name match
  if (cashflowsToSendToAI.length > 0) {
    console.log(`[AI] 🎯 Found ${cashflowsToSendToAI.length} cashflow(s) matching all criteria:`, cashflowsToSendToAI.map(({ cf, invoice }) => ({
      id: cf.id,
      invoiceId: cf.invoiceId,
      importo: cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0),
      note: cf.note,
      descMovimento: cf.descrizione,
      noteFattura: invoice?.note,
      progetto: invoice?.nomeProgetto,
      spesa: invoice?.spesa
    })));
  }

  // Check if we have old-style IDs (long timestamp format) - this indicates cache issue
  const hasOldStyleIds = cashflowRecords.some(cf => cf.id.includes('-') && cf.id.split('-').length === 3 && cf.id.split('-')[1].length > 5);
  if (hasOldStyleIds) {
    console.warn(`[AI] ⚠️ WARNING: Detected old-style cashflow IDs! Please RELOAD the page (F5) to get new progressive IDs from database.`);
  }

  // If no cashflows after all filters, return no match immediately
  if (cashflowsToSendToAI.length === 0) {
    console.log(`[AI] No cashflows matching all criteria`);
    return {
      invoiceId: null,
      cashflowId: null,
      confidence: 0,
      reason: `Nessun movimento disponibile dopo i filtri.`
    };
  }

  const prompt = `CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no backticks, no additional text.

Sei un assistente per la riconciliazione bancaria. Trova il MOVIMENTO DI CASSA che corrisponde alla transazione bancaria.

TRANSAZIONE BANCARIA DA RICONCILIARE:
${formatBankTransaction(transaction)}

MOVIMENTI DI CASSA DISPONIBILI (già filtrati per tipo ${transaction.tipo}, mese/anno, importo IDENTICO e corrispondenza descrizione):
${cashflowsToSendToAI.length > 0
      ? cashflowsToSendToAI.map(({ cf, invoice }) => formatCashflow(cf, invoice)).join('\n')
      : 'Nessun movimento registrato'}

NOTA IMPORTANTE:
I movimenti sono GIÀ FILTRATI per:
- Tipo: ${transaction.tipo}
- Mese/Anno: ${transactionMonth + 1}/${transactionYear}
- Importo: IDENTICO alla transazione (€${transactionAmount.toFixed(2)})
- Descrizione: le parole delle note del movimento appaiono nella descrizione della transazione

Tutti i movimenti che vedi hanno già superato i filtri di importo e descrizione. Devi SOLO scegliere quello più appropriato in base al contesto.

ALGORITMO DI RICONCILIAZIONE:

STEP 1 - VERIFICA DESCRIZIONE (PRIORITÀ MASSIMA):
- **IGNORA COMPLETAMENTE** il campo "Causale:" (es: "PAGAMENTO TRAMITE POS", "COMMISSIONI/SPESE", ecc.)
- Guarda SOLO il campo "Descrizione:" della transazione
- Cerca la pattern "C /O [NOME SERVIZIO]" o il nome dell'azienda nella descrizione
- Estrai il NOME DEL SERVIZIO/AZIENDA (es: ANTHROPIC, FIGMA, CHATGPT, GOOGLE, VERISURE)
- **IGNORA** parole generiche come: tools, costi, servizi, spese, pagamento, pos, carta, usa, italy, debit, visa

ESEMPI DI ESTRAZIONE:
- Descrizione: "POS CARTA CA DEBIT VISA N. ****0428 DEL 13/01/26 ORE 15:26 C /O FIGMA +14158905404 USA"
  → Servizio estratto: "FIGMA" (trovato dopo "C /O")
- Descrizione: "POS CARTA CA DEBIT VISA N. ****0428 DEL 31/12/25 ORE 11:08 C /O ANTHROPIC +14152360599 USA"
  → Servizio estratto: "ANTHROPIC" (trovato dopo "C /O")
- Descrizione: "OPENAI *CHATGPT SUBS"
  → Servizio estratto: "CHATGPT" (parola chiave principale)

STEP 2 - CONFRONTA CON CAMPI SPECIFICI:
Confronta il NOME DEL SERVIZIO SOLO con questi campi SPECIFICI:
  1. Note Movimento (campo "Note Movimento:")
  2. Note Fattura (campo "Note Fattura:")

**IGNORA COMPLETAMENTE**:
  - Spesa (troppo generico: "Tools", "Utenze", ecc.)
  - Tipo Spesa (troppo generico: "Costi per servizi", ecc.)
  - Categoria (troppo generico)

STEP 3 - REGOLE DI MATCHING RIGOROSE:
✅ È UN MATCH SOLO SE:
  - Il NOME DEL SERVIZIO nella descrizione transazione è PRESENTE nelle Note Movimento O Note Fattura
  - Esempio: "ANTHROPIC +1234" matcha SOLO se nelle note c'è "Anthropic", "anthropic", ecc.

❌ NON È UN MATCH SE:
  - Solo parole generiche combaciano ("Tools", "Costi", "Servizi")
  - Il nome del servizio è DIVERSO (es: "ANTHROPIC" != "FIGMA")

Esempi CORRETTI:
  * "ANTHROPIC +14152360599" vs Note: "Anthropic" → ✅ MATCH ("anthropic" presente)
  * "OPENAI *CHATGPT" vs Note: "Chatgpt" → ✅ MATCH ("chatgpt" presente)
  * "FIGMA +1234" vs Note: "Figma" → ✅ MATCH ("figma" presente)

Esempi SBAGLIATI:
  * "ANTHROPIC +14152360599" vs Note: "Figma", Spesa: "Tools" → ❌ NO MATCH (servizio diverso!)
  * "FIGMA +1234" vs Note: "Anthropic", Spesa: "Tools" → ❌ NO MATCH (servizio diverso!)
  * Qualsiasi match basato solo su "Tools", "Costi", "Servizi" → ❌ NO MATCH (troppo generico)

DECISIONE FINALE (SEGUI ESATTAMENTE QUESTE REGOLE RIGOROSE):

IMPORTANTE: Prima di tutto, estrai il NOME DEL SERVIZIO dalla descrizione transazione e verifica se esiste nelle note dei movimenti disponibili.

✅ CASO 1 - MATCH PERFETTO (nome servizio trovato):
   CONDIZIONE OBBLIGATORIA: il NOME DEL SERVIZIO estratto dalla descrizione DEVE essere presente (anche parzialmente) nelle Note Movimento O Note Fattura di ALMENO UN movimento.

   SE trovato:
   → confidence = 95%
   → cashflowId = [ID del movimento che contiene il nome servizio]
   → reason = "Match: [NOME SERVIZIO] trovato in note"

   ESEMPI:
   - Descrizione: "C /O ANTHROPIC +14152360599" → servizio = "ANTHROPIC"
     Movimento: CF-0282, note "Anthropic" → ✅ "ANTHROPIC" presente in "Anthropic" → MATCH!
     Risposta: {"cashflowId": "CF-0282", "confidence": 95, "reason": "Match: ANTHROPIC trovato in note"}

   - Descrizione: "C /O FIGMA +14158905404" → servizio = "FIGMA"
     Movimento: CF-0145, note "Figma" → ✅ "FIGMA" presente in "Figma" → MATCH!
     Risposta: {"cashflowId": "CF-0145", "confidence": 95, "reason": "Match: FIGMA trovato in note"}

   - Descrizione: "C /O ANTHROPIC +14152360599" → servizio = "ANTHROPIC"
     Movimento: CF-0145, note "Figma" → ❌ "ANTHROPIC" NON presente in "Figma" → NO MATCH!
     VAI AL CASO 2!

❌ CASO 2 - SERVIZIO NON TROVATO (confidence = 0%):
   CONDIZIONE: il NOME DEL SERVIZIO estratto dalla descrizione NON è presente in NESSUNA Note Movimento O Note Fattura dei movimenti disponibili.

   ANCHE SE:
   - C'è un movimento con importo identico
   - È l'unico movimento disponibile
   - Spesa e Tipo Spesa coincidono (SONO TROPPO GENERICI!)

   → confidence = 0%
   → cashflowId = null
   → reason = "Nessun movimento corrisponde a [NOME SERVIZIO] (trovati solo: [lista nomi servizi nei movimenti])"

   ESEMPI CRITICI - SEGUI QUESTI:
   - Descrizione: "C /O ANTHROPIC +14152360599" → servizio = "ANTHROPIC"
     Movimenti disponibili: CF-0145 note "Figma", CF-0164 note "Figma"
     → ❌ "ANTHROPIC" NON trovato in nessuna nota → NO MATCH!
     Risposta: {"cashflowId": null, "confidence": 0, "reason": "Nessun movimento corrisponde a ANTHROPIC (trovati solo: Figma)"}

   - Descrizione: "C /O ANTHROPIC +14152360599" → servizio = "ANTHROPIC"
     Movimento: CF-0145, €20.00, note "Figma", spesa "Tools", tipo_spesa "Costi per servizi"
     → ❌ "ANTHROPIC" != "Figma" → NO MATCH! (ignora spesa e tipo_spesa!)
     Risposta: {"cashflowId": null, "confidence": 0, "reason": "Nessun movimento corrisponde a ANTHROPIC (trovati solo: Figma)"}

❌ CASO 3 - MULTIPLI MOVIMENTI STESSO IMPORTO:
   SE hai più movimenti con importo uguale MA NESSUNO ha il nome servizio che matcha:
   → confidence = 0%
   → cashflowId = null
   → reason = "Trovati [N] movimenti con importo €[X] ma nessuno corrisponde a [SERVIZIO]"

❌ CASO 4 - NESSUN MOVIMENTO:
   → confidence = 0%
   → cashflowId = null
   → reason = "Nessun movimento disponibile"

**REGOLA D'ORO ASSOLUTA - LEGGI ATTENTAMENTE**:

❌ SE il nome del servizio nella descrizione transazione NON È PRESENTE nelle Note Movimento O Note Fattura:
   → confidence = 0%
   → cashflowId = null
   → reason = "Nessun movimento corrisponde a [NOME SERVIZIO]"

ESEMPI CRITICI DA SEGUIRE:
- Transazione: "C /O ANTHROPIC" → servizio = "ANTHROPIC"
  Movimenti disponibili: CF-0145 note "Figma", CF-0164 note "Figma"
  → ❌ NESSUNO ha "Anthropic" nelle note
  → confidence = 0%, cashflowId = null
  → reason = "Nessun movimento corrisponde a ANTHROPIC"

- Transazione: "C /O FIGMA" → servizio = "FIGMA"
  Movimenti disponibili: CF-0145 note "Figma"
  → ✅ CF-0145 ha "Figma" nelle note
  → confidence = 95%, cashflowId = "CF-0145"
  → reason = "Match: FIGMA trovato in note"

NON abbinare MAI se il nome servizio è diverso, ANCHE SE:
- È l'unico movimento con quell'importo
- Importo è identico
- Spesa e Tipo Spesa sono uguali (sono troppo generici!)

Il nome del servizio DEVE corrispondere, altrimenti confidence = 0%!

REGOLE CRITICHE - LEGGI ATTENTAMENTE:
1. MATCHING CASE-INSENSITIVE: "ANTHROPIC" = "Anthropic" = "anthropic" → SONO IDENTICI!
2. PAROLA PARZIALE OK: "CHATGPT" contiene "ChatGPT", "GPT" → MATCH!
3. SE C'È ANCHE UNA SOLA PAROLA COMUNE (>3 lettere) → CONFIDENCE 95%!
4. **REGOLA ANTI-MISMATCH**: Se la descrizione contiene una parola chiave (es. "ANTHROPIC") ma il movimento contiene una DIVERSA parola chiave (es. "Figma", "Netflix", ecc.), NON È UN MATCH! Confidence = 0%!
5. IGNORA COMPLETAMENTE i movimenti senza match di descrizione, anche se l'importo è perfetto
6. **ESEMPIO DI NON-MATCH**: "ANTHROPIC +123" vs Note: "Figma" → 0% (parole diverse!)

ESEMPI CHIARI DI MATCH:
✅ "ANTHROPIC +14152360599" vs Note Fattura: "Anthropic" → 95% (parola identica!)
✅ "ANTHROPIC +14152360599" vs Spesa: "Tools", Note: "Anthropic" → 95% (parola in note!)
✅ "OPENAI *CHATGPT SUBS" vs Note Movimento: "Chatgpt" → 95% (parola identica!)
✅ "OPENAI *CHATGPT SUBS" vs Spesa: "Chatgpt", Tipo Spesa: "Costi per servizi" → 95% (parola in spesa!)
✅ "VERISURE ITALY SRL" vs Spesa: "Verisure" → 95% (parola identica!)
✅ "VERISURE ITALY SRL" vs Note: "Verisure alarm", Spesa: "Utenze" → 95% (parola in note!)
✅ "GOOGLE WORKSPACE" vs Tipo Spesa: "Costi per servizi", Note: "Google" → 95% (parola in note!)
❌ "Compensazione approssimazione" vs Note: "Anthropic", Spesa: "Tools" → 0% (nessuna parola comune!)

FORMATO RISPOSTA OBBLIGATORIO:
IMPORTANT: Your response must be ONLY the JSON object below. Do not write any text before or after the JSON.
Do not use markdown code blocks. Do not add explanations. Just the raw JSON object.

CRITICAL:
- "cashflowId" must be the EXACT ID from the cashflow (e.g., "CF-0289", never format it differently)
- "invoiceId" must be the EXACT ID from "Fattura:" field (e.g., "Fattura_90", never use formatted numbers like "90/2026")
- If no match, both IDs must be null

{"invoiceId": null, "cashflowId": "CF-XXX o null", "confidence": numero_0_100, "reason": "spiegazione breve in italiano"}

ESEMPI DI RISPOSTE VALIDE (copia questo formato esatto):

✅ ESEMPIO 1 - Match perfetto con un solo movimento:
Transazione: "ANTHROPIC +14152360599 USA" €10.00 del 02/01/2026
Movimento disponibile: ID: CF-0053 | Fattura: Fattura_114 | €10.00 | Note Fattura: "Anthropic"
→ {"invoiceId": "Fattura_114", "cashflowId": "CF-0053", "confidence": 95, "reason": "Match perfetto: CF-0053 per €10.00 - 'Anthropic' trovato in note"}

✅ ESEMPIO 2 - Match perfetto tra multipli movimenti:
Transazione: "OPENAI *CHATGPT SUBS +14158799686 USA" €17.08 del 03/01/2026
Movimenti disponibili:
  - ID: CF-0058 | €17.08 | Note Movimento: "Chatgpt" | Spesa: "Tools"
  - ID: CF-0060 | €17.50 | Note Movimento: "Spotify" | Spesa: "Intrattenimento"
  - ID: CF-0062 | €16.99 | Note Movimento: "Netflix" | Spesa: "Intrattenimento"
→ {"invoiceId": null, "cashflowId": "CF-0058", "confidence": 95, "reason": "Match perfetto: CF-0058 per €17.08 - unico movimento con 'Chatgpt' nelle note"}

✅ ESEMPIO 3 - Match tramite colonna Spesa (anche se Note è vuota):
Transazione: "VERISURE ITALY SRL" €67.08 del 05/01/2026
Movimento disponibile: ID: CF-0090 | €67.08 | Spesa: "Verisure" | Note Fattura: "" (vuota)
→ {"invoiceId": null, "cashflowId": "CF-0090", "confidence": 95, "reason": "Match perfetto: CF-0090 per €67.08 - 'Verisure' trovato in spesa"}

✅ ESEMPIO 3b - Match tramite Tipo Spesa:
Transazione: "OPENAI API USAGE" €15.00 del 10/01/2026
Movimento disponibile: ID: CF-0120 | €15.00 | Tipo Spesa: "Costi per servizi" | Spesa: "OpenAI" | Note: ""
→ {"invoiceId": null, "cashflowId": "CF-0120", "confidence": 95, "reason": "Match perfetto: CF-0120 per €15.00 - 'OpenAI' trovato in spesa"}

⚠️ ESEMPIO 4 - Un solo movimento ma descrizione non chiara:
Transazione: "PAGAMENTO POS GENERICO" €67.08 del 02/01/2026
Movimento disponibile: ID: CF-0123 | €67.08 | Note: "Abbonamento vario"
→ {"invoiceId": null, "cashflowId": "CF-0123", "confidence": 60, "reason": "Importo compatibile (€67.08) ma descrizione non corrisponde - verifica manuale"}

❌ ESEMPIO 5 - Multipli movimenti senza match chiaro:
Transazione: "Bonifico generico" €50.00 del 02/01/2026
Movimenti disponibili: CF-0100 (€50.00, Note: "Servizio A"), CF-0101 (€50.00, Note: "Servizio B")
→ {"invoiceId": null, "cashflowId": null, "confidence": 0, "reason": "Trovati 2 movimenti ma nessuno corrisponde alla descrizione 'Bonifico generico'"}

❌ ESEMPIO 6 - Nessun movimento con importo compatibile:
Transazione: "Commissioni bancarie" €0.59 del 02/01/2026
Movimenti disponibili: (nessuno - già filtrati)
→ {"invoiceId": null, "cashflowId": null, "confidence": 0, "reason": "Nessun movimento disponibile"}`;

  try {
    const selectedModel = model || 'claude-3-5-haiku-20241022';
    console.log('\n🤖 STEP 3: CALLING AI');
    console.log(`   Model: ${selectedModel}`);
    console.log(`   Sending ${cashflowsToSendToAI.length} cashflow(s) for final analysis...`);

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

    console.log('\n🎯 STEP 4: AI RESPONSE');
    console.log(`   Raw JSON: ${cleanedText}`);
    console.log(`   ├─ cashflowId: ${result.cashflowId || 'null'}`);
    console.log(`   ├─ invoiceId: ${result.invoiceId || 'null'}`);
    console.log(`   ├─ confidence: ${result.confidence}%`);
    console.log(`   └─ reason: "${result.reason}"`);

    // CRITICAL: Verify amount match before accepting AI suggestion
    console.log('\n✅ STEP 5: VERIFICATION');
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
