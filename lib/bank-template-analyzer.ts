import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from './supabase';

export interface BankColumnMapping {
  dataOp?: number;
  dataVal?: number;
  causale?: number;
  descrizione?: number;
  importo?: number;
  entrate?: number;
  uscite?: number;
  saldo?: number;
}

export interface BankTemplate {
  id: string;
  bankName: string;
  isDefault: boolean;
  createdAt: string;
  headerRowIndex: number;
  dataStartRow: number;
  columns: BankColumnMapping;
  importoType: 'signed' | 'separate';
  positiveIsEntrata: boolean;
  samplePreview: string;
}

// ── DB row → BankTemplate ──────────────────────────────────────────────────
function fromRow(row: Record<string, unknown>): BankTemplate {
  return {
    id: row.id as string,
    bankName: row.bank_name as string,
    isDefault: row.is_default as boolean,
    createdAt: row.created_at as string,
    headerRowIndex: row.header_row_index as number,
    dataStartRow: row.data_start_row as number,
    columns: row.columns as BankColumnMapping,
    importoType: row.importo_type as 'signed' | 'separate',
    positiveIsEntrata: row.positive_is_entrata as boolean,
    samplePreview: row.sample_preview as string,
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getBankTemplates(companyId: string): Promise<BankTemplate[]> {
  const { data, error } = await supabase
    .from('bank_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[getBankTemplates]', error); return []; }
  return (data ?? []).map(fromRow);
}

export async function saveBankTemplate(template: BankTemplate, companyId: string): Promise<void> {
  const row = {
    id: template.id,
    company_id: companyId,
    bank_name: template.bankName,
    is_default: template.isDefault,
    header_row_index: template.headerRowIndex,
    data_start_row: template.dataStartRow,
    columns: template.columns,
    importo_type: template.importoType,
    positive_is_entrata: template.positiveIsEntrata,
    sample_preview: template.samplePreview,
  };
  const { error } = await supabase
    .from('bank_templates')
    .upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`Errore salvataggio template: ${error.message}`);
}

// Imposta o rimuove il template default in modo atomico via RPC.
// Passare templateId = null per rimuovere il default senza impostarne uno nuovo.
export async function setDefaultTemplate(templateId: string | null, companyId: string): Promise<void> {
  const { error } = await supabase.rpc('set_default_bank_template', {
    p_template_id: templateId,
    p_company_id: companyId,
  });
  if (error) throw new Error(`Errore impostazione default: ${error.message}`);
}

export async function deleteBankTemplate(id: string, companyId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw new Error(`Errore eliminazione template: ${error.message}`);
}

// ── AI analysis ────────────────────────────────────────────────────────────

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
          header: 1, defval: '', raw: false, range: 'A1:P30'
        }) as string[][];
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsArrayBuffer(file);
  });
}

function formatRowsForAI(rows: string[][]): string {
  return rows
    .map((row, i) => `RIGA[${i}]: ${row.map(c => String(c ?? '').trim()).join(' | ')}`)
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

  const previewRows = rows.slice(parsed.headerRowIndex, parsed.dataStartRow + 3);
  const samplePreview = formatRowsForAI(previewRows);

  return {
    id: crypto.randomUUID(),
    bankName,
    isDefault: false,
    createdAt: new Date().toISOString(),
    headerRowIndex: parsed.headerRowIndex,
    dataStartRow: parsed.dataStartRow,
    columns: parsed.columns,
    importoType: parsed.importoType,
    positiveIsEntrata: parsed.positiveIsEntrata,
    samplePreview,
  };
}
