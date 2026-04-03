import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface BankColumnMapping {
  dataOp?: number;      // data operazione
  dataVal?: number;     // data valuta
  causale?: number;     // causale / tipo operazione
  descrizione?: number; // descrizione / dettaglio
  importo?: number;     // importo con segno (positivo=entrata o uscita, dipende da positiveIsEntrata)
  entrate?: number;     // colonna entrate (se separata da uscite)
  uscite?: number;      // colonna uscite (se separata da entrate)
  saldo?: number;       // saldo
}

export interface BankTemplate {
  id: string;
  bankName: string;
  createdAt: string;
  headerRowIndex: number;     // indice riga header (0-based)
  dataStartRow: number;       // indice prima riga dati (0-based)
  columns: BankColumnMapping;
  importoType: 'signed' | 'separate'; // signed = unica colonna con segno; separate = entrate/uscite divise
  positiveIsEntrata: boolean;
  samplePreview: string;      // prime righe formattate per anteprima
}

const TEMPLATES_STORAGE_KEY = 'bank_templates_v1';

export function getBankTemplates(): BankTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BankTemplate[];
  } catch {
    return [];
  }
}

export function saveBankTemplate(template: BankTemplate): void {
  const templates = getBankTemplates();
  const existingIdx = templates.findIndex(t => t.id === template.id);
  if (existingIdx >= 0) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function deleteBankTemplate(id: string): void {
  const templates = getBankTemplates().filter(t => t.id !== id);
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function getAISettings() {
  try {
    const raw = localStorage.getItem('ai_settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractRawRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
          range: 'A1:P30'
        }) as string[][];
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsArrayBuffer(file);
  });
}

function formatRowsForAI(rows: string[][]): string {
  return rows
    .map((row, i) => {
      const cells = row.map(c => String(c ?? '').trim());
      return `RIGA[${i}]: ${cells.join(' | ')}`;
    })
    .join('\n');
}

function buildPrompt(rowsText: string): string {
  return `Sei un esperto di estratti conto bancari. Analizza le seguenti righe di un file Excel di un estratto conto e identifica la struttura delle colonne.

${rowsText}

Identifica con precisione:
1. headerRowIndex: indice (0-based) della riga che contiene le intestazioni delle colonne (es. "Data", "Importo", "Descrizione", ecc.)
2. dataStartRow: indice (0-based) della prima riga che contiene dati reali di transazione (subito dopo l'header)
3. columns: mappatura colonne (indici 0-based). Includi solo i campi presenti:
   - dataOp: colonna data operazione
   - dataVal: colonna data valuta (opzionale)
   - causale: colonna causale o tipo operazione (opzionale)
   - descrizione: colonna descrizione o dettaglio del movimento
   - importo: colonna importo (se esiste una sola colonna con segno)
   - entrate: colonna entrate (se esistono due colonne separate)
   - uscite: colonna uscite (se esistono due colonne separate)
   - saldo: colonna saldo (opzionale)
4. importoType: "signed" se c'è una sola colonna importo (con segno + o - oppure negativi per uscite), "separate" se ci sono due colonne distinte entrate e uscite
5. positiveIsEntrata: true se i valori positivi rappresentano entrate (di solito true), false se i valori positivi rappresentano uscite

Rispondi ONLY con JSON valido, senza markdown, senza spiegazioni:
{"headerRowIndex":8,"dataStartRow":9,"columns":{"dataOp":0,"dataVal":1,"causale":2,"descrizione":3,"importo":4,"saldo":5},"importoType":"signed","positiveIsEntrata":false}`;
}

export async function analyzeTemplateWithAI(
  file: File,
  bankName: string,
  model?: string
): Promise<BankTemplate> {
  const rows = await extractRawRows(file);
  const rowsText = formatRowsForAI(rows.slice(0, 25));
  const prompt = buildPrompt(rowsText);
  const settings = getAISettings();
  const selectedModel = model || settings?.defaultAiModel || 'claude-haiku-4-5-20251001';

  let responseText = '';

  if (selectedModel.startsWith('gpt-')) {
    const apiKey = settings?.openaiApiKey;
    if (!apiKey) throw new Error('API Key OpenAI non configurata');
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const res = await openai.chat.completions.create({
      model: selectedModel,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });
    responseText = res.choices[0]?.message?.content || '';
  } else {
    const apiKey = settings?.anthropicApiKey;
    if (!apiKey) throw new Error('API Key Anthropic non configurata');
    const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const res = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 500,
      system: 'Sei un esperto analizzatore di strutture Excel per estratti conto bancari. Rispondi SOLO con JSON valido.',
      messages: [{ role: 'user', content: prompt }]
    });
    const block = res.content[0];
    responseText = block.type === 'text' ? block.text : '';
  }

  // Parse JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Risposta AI non valida: JSON non trovato');

  let parsed: {
    headerRowIndex: number;
    dataStartRow: number;
    columns: BankColumnMapping;
    importoType: 'signed' | 'separate';
    positiveIsEntrata: boolean;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Risposta AI non valida: JSON malformato');
  }

  // Build sample preview (header row + first 3 data rows)
  const previewRows = rows.slice(parsed.headerRowIndex, parsed.dataStartRow + 3);
  const samplePreview = formatRowsForAI(previewRows);

  const template: BankTemplate = {
    id: crypto.randomUUID(),
    bankName,
    createdAt: new Date().toISOString(),
    headerRowIndex: parsed.headerRowIndex,
    dataStartRow: parsed.dataStartRow,
    columns: parsed.columns,
    importoType: parsed.importoType,
    positiveIsEntrata: parsed.positiveIsEntrata,
    samplePreview
  };

  return template;
}
