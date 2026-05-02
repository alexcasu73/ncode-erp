import * as XLSX from 'xlsx';
import type { BankTemplate, BankColumnMapping } from './bank-template-analyzer';

export interface ParsedBankStatement {
  numeroConto?: string;
  dataAggiornamento?: string;
  saldoIniziale?: number;
  saldoFinale?: number;
  periodoDal?: string;
  periodoAl?: string;
  transactions: ParsedTransaction[];
  parsingStats?: {
    totalRows: number;
    skippedNoDate: number;
    skippedInvalidDate: number;
    skippedZeroAmount: number;
  };
}

export interface ParsedTransaction {
  data: string;           // YYYY-MM-DD
  dataValuta?: string;    // YYYY-MM-DD
  causale?: string;
  descrizione: string;
  importo: number;
  tipo: 'Entrata' | 'Uscita';
  saldo?: number;
  hasErrors?: boolean;    // Flag for problematic rows
}

// Parse date from various formats (DD/MM/YYYY, DD-MM-YYYY, Excel serial)
function parseDate(value: any): string | undefined {
  if (!value) return undefined;

  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a string date
  if (typeof value === 'string') {
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // Try DD/MM/YYYY or DD-MM-YYYY (4-digit year)
    const match4 = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match4) {
      const day = match4[1].padStart(2, '0');
      const month = match4[2].padStart(2, '0');
      const year = match4[3];
      return `${year}-${month}-${day}`;
    }
    // Try M/D/YY or MM/DD/YY (2-digit year, US format)
    const match2 = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (match2) {
      const month = match2[1].padStart(2, '0');
      const day = match2[2].padStart(2, '0');
      const year = parseInt(match2[3]) >= 50 ? `19${match2[3]}` : `20${match2[3]}`;
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}

// Parse amount from string or number (handles various formats)
function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  let str = String(value).trim();

  // Remove currency suffix (EUR, €)
  str = str.replace(/\s*(EUR|€)\s*$/i, '');

  // Check for negative in parentheses: (123.45) -> -123.45
  const isNegativeParentheses = str.startsWith('(') && str.endsWith(')');
  if (isNegativeParentheses) {
    str = str.slice(1, -1); // Remove parentheses
  }

  // Detect format: if contains both . and , determine which is decimal
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    // Both present: last one is decimal separator
    const dotIndex = str.lastIndexOf('.');
    const commaIndex = str.lastIndexOf(',');

    if (commaIndex > dotIndex) {
      // Italian format: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // English format: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma: could be decimal (Italian) or thousand separator
    // If comma is followed by exactly 2 digits at end, it's decimal
    if (/,\d{2}$/.test(str)) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  // If only dot, it's already in correct format

  const num = parseFloat(str);
  const result = isNaN(num) ? 0 : num;

  return isNegativeParentheses ? -result : result;
}

// Extract metadata from header rows (Crédit Agricole format)
function extractMetadata(rows: any[][]): Partial<ParsedBankStatement> {
  const metadata: Partial<ParsedBankStatement> = {};

  // Search in first 10 rows for metadata
  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 10); rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (!cell || typeof cell !== 'string') continue;

      const cellLower = cell.toLowerCase().trim();

      // Numero Conto
      if (cellLower === 'numero conto' || cellLower.includes('numero conto')) {
        const nextVal = row[i + 1];
        if (nextVal) {
          metadata.numeroConto = String(nextVal).trim();
        }
      }

      // Data Aggiornamento
      if (cellLower === 'data aggiornamento' || cellLower.includes('aggiornamento')) {
        const nextVal = row[i + 1];
        if (nextVal) {
          metadata.dataAggiornamento = parseDate(nextVal);
        }
      }

      // Saldo Iniziale
      if (cellLower === 'saldo iniziale' || cellLower.includes('iniziale')) {
        const nextVal = row[i + 1];
        if (nextVal !== undefined && nextVal !== null) {
          metadata.saldoIniziale = parseAmount(nextVal);
        }
      }

      // Saldo Finale
      if (cellLower === 'saldo finale' || cellLower.includes('finale')) {
        const nextVal = row[i + 1];
        if (nextVal !== undefined && nextVal !== null) {
          metadata.saldoFinale = parseAmount(nextVal);
        }
      }

      // Data dal
      if (cellLower === 'data dal' || cellLower === 'dal') {
        const nextVal = row[i + 1];
        if (nextVal) {
          metadata.periodoDal = parseDate(nextVal);
        }
      }

      // Data al
      if (cellLower === 'data al' || cellLower === 'al') {
        const nextVal = row[i + 1];
        if (nextVal) {
          metadata.periodoAl = parseDate(nextVal);
        }
      }
    }
  }

  return metadata;
}

// Keyword variants per colonna (più banche supportate)
const HEADER_KEYWORDS: Record<string, string[]> = {
  dataOp:      ['data op', 'data oper', 'data movimento', 'data transazione', 'data contabile', 'data val', 'data'],
  causale:     ['causale', 'tipo oper', 'tipo movim', 'descrizione breve', 'categoria'],
  descrizione: ['descrizione', 'dettaglio', 'dicitura', 'note', 'narrative'],
  importo:     ['importo', 'amount', 'valore', 'importo mov'],
  entrate:     ['entrate', 'avere', 'accredito', 'accrediti', 'credito', 'credit'],
  uscite:      ['uscite', 'dare', 'addebito', 'addebiti', 'debito', 'debit'],
  saldo:       ['saldo'],
};

// Scansiona le righe dati per trovare le colonne con valori numerici (importi)
function inferNumericColumns(rows: any[][], dataStartRow: number): number[] {
  const colNumericCount: Record<number, number> = {};
  const sampleRows = rows.slice(dataStartRow, dataStartRow + 15);

  for (const row of sampleRows) {
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const val = row[j];
      if (val === null || val === undefined || val === '') continue;
      const n = parseAmount(val);
      if (n !== 0) {
        colNumericCount[j] = (colNumericCount[j] || 0) + 1;
      }
    }
  }

  // Ordina per frequenza decrescente, escludi colonne con valori come anni (es. 2026)
  return Object.entries(colNumericCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .map(([col]) => Number(col));
}

// Fallback finale: rileva header cercando la prima riga con data + dati numerici
function inferHeaderFromData(rows: any[][]): { headerRowIndex: number; columnMap: Record<string, number> } {
  for (let i = 0; i < Math.min(rows.length - 5, 30); i++) {
    const row = rows[i];
    if (!row) continue;

    // Cerca una riga che sembra un header (stringhe non numeriche)
    const isHeaderLike = row.some(c => c && typeof c === 'string' && isNaN(Number(c)));
    if (!isHeaderLike) continue;

    // Verifica che la riga successiva abbia date valide
    const nextRow = rows[i + 1];
    if (!nextRow) continue;
    const hasDateInNext = nextRow.some(c => parseDate(c) !== undefined);
    if (!hasDateInNext) continue;

    // Trova colonna data
    let dateCol = -1;
    for (let j = 0; j < (nextRow.length || 0); j++) {
      if (parseDate(nextRow[j])) { dateCol = j; break; }
    }
    if (dateCol === -1) continue;

    // Trova colonne numeriche
    const numericCols = inferNumericColumns(rows, i + 1);
    if (numericCols.length === 0) continue;

    // Trova colonna descrizione (stringa più lunga nei dati)
    let descCol = -1;
    let maxLen = 0;
    for (let j = 0; j < (nextRow.length || 0); j++) {
      if (j === dateCol || numericCols.includes(j)) continue;
      const val = nextRow[j];
      if (val && typeof val === 'string' && val.length > maxLen) {
        maxLen = val.length;
        descCol = j;
      }
    }

    const columnMap: Record<string, number> = { dataOp: dateCol };
    if (descCol !== -1) columnMap['descrizione'] = descCol;
    if (numericCols.length >= 2) {
      columnMap['entrate'] = numericCols[0];
      columnMap['uscite'] = numericCols[1];
    } else {
      columnMap['importo'] = numericCols[0];
    }

    console.log(`✅ Header inferito automaticamente a riga ${i + 1}:`, columnMap);
    return { headerRowIndex: i, columnMap };
  }

  console.log('⚠️ Impossibile rilevare header — uso fallback generico');
  return {
    headerRowIndex: 0,
    columnMap: { dataOp: 0, descrizione: 1, importo: 2 },
  };
}

// Find header row and column indices
function findHeaders(rows: any[][]): { headerRowIndex: number; columnMap: Record<string, number> } {
  console.log('🔍 Auto-detecting headers in first 25 rows...');

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row) continue;

    const normalizedRow = row.map(cell =>
      cell ? String(cell).toLowerCase().trim() : ''
    );

    const columnMap: Record<string, number> = {};
    let matchCount = 0;

    for (let j = 0; j < normalizedRow.length; j++) {
      const cell = normalizedRow[j];
      if (!cell) continue;
      for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
        if (!(field in columnMap) && keywords.some(kw => cell.includes(kw))) {
          columnMap[field] = j;
          matchCount++;
          break;
        }
      }
    }

    // Riga header valida: almeno data + (importo o entrate/uscite) + descrizione
    const hasDate = 'dataOp' in columnMap;
    const hasAmount = 'importo' in columnMap || ('entrate' in columnMap && 'uscite' in columnMap);
    const hasDesc = 'descrizione' in columnMap || 'causale' in columnMap;

    if (hasDate && hasAmount && hasDesc) {
      console.log(`✅ Header trovato a riga ${i + 1}:`, columnMap);
      return { headerRowIndex: i, columnMap };
    }

    // Header parziale: data trovata ma importo mancante → cerca colonne numeriche nei dati
    if (hasDate && hasDesc && !hasAmount) {
      const numericCols = inferNumericColumns(rows, i + 1);
      if (numericCols.length >= 2) {
        columnMap['entrate'] = numericCols[0];
        columnMap['uscite'] = numericCols[1];
        console.log(`✅ Header trovato a riga ${i + 1} (importo inferito dai dati):`, columnMap);
        return { headerRowIndex: i, columnMap };
      } else if (numericCols.length === 1) {
        columnMap['importo'] = numericCols[0];
        console.log(`✅ Header trovato a riga ${i + 1} (importo inferito dai dati):`, columnMap);
        return { headerRowIndex: i, columnMap };
      }
    }
  }

  // Ultimo fallback: cerca la prima riga con una data valida e colonne numeriche
  console.log('⚠️ Header non trovato con keyword — tentativo rilevamento automatico da dati...');
  return inferHeaderFromData(rows);
}

// Parse transactions from data rows
function parseTransactions(rows: any[][], startRow: number, columnMap: Record<string, number>): { transactions: ParsedTransaction[]; stats: { totalRows: number; skippedNoDate: number; skippedInvalidDate: number; skippedZeroAmount: number } } {
  const transactions: ParsedTransaction[] = [];
  let skippedNoDate = 0;
  let skippedInvalidDate = 0;
  let skippedZeroAmount = 0;
  let consecutiveEmptyRows = 0;
  const totalRows = rows.length - startRow;

  console.log(`📊 Parsing transactions starting from row ${startRow}, total rows: ${rows.length}`);
  console.log('Column mapping:', columnMap);

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];

    // Stop if we hit 10 consecutive empty rows (likely end of transactions)
    if (!row || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows >= 10) {
        console.log(`🛑 Stopped at row ${i}: 10 consecutive empty rows (end of transactions)`);
        break;
      }
      continue;
    }

    consecutiveEmptyRows = 0;

    // Build warning messages for problematic rows
    const warnings: string[] = [];

    // Handle missing or invalid date
    const dataOp = row[columnMap.dataOp];
    let parsedDate: string;

    if (!dataOp) {
      skippedNoDate++;
      parsedDate = new Date().toISOString().split('T')[0]; // Use today as placeholder
      warnings.push('⚠️ DATA MANCANTE');
      console.log(`⚠️ Row ${i}: No date, using placeholder`);
    } else {
      const dateAttempt = parseDate(dataOp);
      if (!dateAttempt) {
        skippedInvalidDate++;
        parsedDate = new Date().toISOString().split('T')[0]; // Use today as placeholder
        warnings.push(`⚠️ DATA INVALIDA: ${String(dataOp)}`);
        console.log(`⚠️ Row ${i}: Invalid date format:`, dataOp);
      } else {
        parsedDate = dateAttempt;
      }
    }

    // Handle zero or missing amount
    const importo = parseAmount(row[columnMap.importo]);
    if (importo === 0) {
      skippedZeroAmount++;
      warnings.push('⚠️ IMPORTO ZERO O MANCANTE');
      console.log(`⚠️ Row ${i}: Zero amount, raw value:`, row[columnMap.importo]);
    }

    const causaleRaw = row[columnMap.causale] ? String(row[columnMap.causale]).trim() : '';
    const descrizioneRaw = row[columnMap.descrizione] ? String(row[columnMap.descrizione]).trim() : '';

    // Skip footer/summary rows (no date + summary keywords)
    if (!dataOp && /totale|saldo contabile/i.test(descrizioneRaw)) {
      console.log(`⏭️ Row ${i}: Skipping footer row: "${descrizioneRaw}"`);
      continue;
    }

    // Build description with warnings
    let descrizione = descrizioneRaw;
    if (warnings.length > 0) {
      descrizione = warnings.join(' ') + (descrizione ? ' | ' + descrizione : '');
    }

    // Determine tipo: negative amount = always Uscita.
    // For positive amounts in CA format (all amounts are absolute), use causale.
    const CAUSALI_USCITA = [
      'PAGAMENTO TRAMITE POS',
      'COMMISSIONI/SPESE',
      'PAGAMENTO UTENZE',
      'IMPOSTE E TASSE',
      'PAGAMENTO RATE FINANZIAMENTO',
      'ADDEBITO PREAUTORIZZATO',
      'ADDEBITO DIRETTO',
    ];
    let tipo: 'Entrata' | 'Uscita';
    if (importo < 0) {
      tipo = 'Uscita';
    } else if (CAUSALI_USCITA.some(c => causaleRaw.toUpperCase().includes(c))) {
      tipo = 'Uscita';
    } else {
      tipo = 'Entrata';
    }

    const transaction: ParsedTransaction = {
      data: parsedDate,
      dataValuta: parseDate(row[columnMap.dataVal]),
      causale: causaleRaw || undefined,
      descrizione,
      importo: Math.abs(importo),
      tipo,
      saldo: row[columnMap.saldo] !== undefined ? parseAmount(row[columnMap.saldo]) : undefined,
      hasErrors: warnings.length > 0
    };

    transactions.push(transaction);
  }

  console.log(`✅ Parsed ${transactions.length} transactions`);
  console.log(`⚠️  Problematic rows: ${skippedNoDate} (no date), ${skippedInvalidDate} (invalid date), ${skippedZeroAmount} (zero amount)`);

  return {
    transactions,
    stats: { totalRows, skippedNoDate, skippedInvalidDate, skippedZeroAmount }
  };
}

// Parse transactions from data rows using a BankTemplate (for separate entrate/uscite columns)
function parseTransactionsWithTemplate(
  rows: any[][],
  template: BankTemplate
): { transactions: ParsedTransaction[]; stats: { totalRows: number; skippedNoDate: number; skippedInvalidDate: number; skippedZeroAmount: number } } {
  const { columns, importoType, positiveIsEntrata, dataStartRow } = template;

  const transactions: ParsedTransaction[] = [];
  let skippedNoDate = 0;
  let skippedInvalidDate = 0;
  let skippedZeroAmount = 0;
  let consecutiveEmptyRows = 0;
  const totalRows = rows.length - dataStartRow;

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];

    if (!row || !row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')) {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows >= 10) break;
      continue;
    }
    consecutiveEmptyRows = 0;

    const warnings: string[] = [];

    // Date
    const dataOpRaw = columns.dataOp !== undefined ? row[columns.dataOp] : null;
    let parsedDate: string;
    if (!dataOpRaw) {
      skippedNoDate++;
      parsedDate = new Date().toISOString().split('T')[0];
      warnings.push('⚠️ DATA MANCANTE');
    } else {
      const dateAttempt = parseDate(dataOpRaw);
      if (!dateAttempt) {
        skippedInvalidDate++;
        parsedDate = new Date().toISOString().split('T')[0];
        warnings.push(`⚠️ DATA INVALIDA: ${String(dataOpRaw)}`);
      } else {
        parsedDate = dateAttempt;
      }
    }

    // Amount
    let rawAmount = 0;
    let tipo: 'Entrata' | 'Uscita' = 'Uscita';

    if (importoType === 'separate') {
      const entrate = columns.entrate !== undefined ? parseAmount(row[columns.entrate]) : 0;
      const uscite = columns.uscite !== undefined ? parseAmount(row[columns.uscite]) : 0;
      if (entrate && entrate !== 0) {
        rawAmount = Math.abs(entrate);
        tipo = 'Entrata';
      } else if (uscite && uscite !== 0) {
        rawAmount = Math.abs(uscite);
        tipo = 'Uscita';
      }
    } else {
      const imp = columns.importo !== undefined ? parseAmount(row[columns.importo]) : 0;
      rawAmount = Math.abs(imp);
      tipo = positiveIsEntrata ? (imp >= 0 ? 'Entrata' : 'Uscita') : (imp >= 0 ? 'Uscita' : 'Entrata');
    }

    if (rawAmount === 0) {
      skippedZeroAmount++;
      warnings.push('⚠️ IMPORTO ZERO O MANCANTE');
    }

    let descrizione = columns.descrizione !== undefined && row[columns.descrizione]
      ? String(row[columns.descrizione]).trim()
      : '';
    if (warnings.length > 0) {
      descrizione = warnings.join(' ') + (descrizione ? ' | ' + descrizione : '');
    }

    transactions.push({
      data: parsedDate,
      dataValuta: columns.dataVal !== undefined ? parseDate(row[columns.dataVal]) : undefined,
      causale: columns.causale !== undefined && row[columns.causale] ? String(row[columns.causale]).trim() : undefined,
      descrizione,
      importo: rawAmount,
      tipo,
      saldo: columns.saldo !== undefined && row[columns.saldo] !== undefined ? parseAmount(row[columns.saldo]) : undefined,
      hasErrors: warnings.length > 0
    });
  }

  return { transactions, stats: { totalRows, skippedNoDate, skippedInvalidDate, skippedZeroAmount } };
}

// Main parser function
export function parseBankStatementExcel(file: File, template?: BankTemplate): Promise<ParsedBankStatement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        // Get first sheet (usually "Lista Movimenti")
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // FORCE reading up to row 200 to capture all transactions (Crédit Agricole files can have gaps)
        const forceRange = `A1:P200`;

        // Convert to 2D array with extended range to avoid stopping at empty rows
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
          range: forceRange
        }) as any[][];

        console.log(`📄 Excel file "${file.name}" - Total rows read: ${rows.length}`);

        // Extract metadata from header rows
        const metadata = extractMetadata(rows);

        let transactions: ParsedTransaction[];
        let stats: { totalRows: number; skippedNoDate: number; skippedInvalidDate: number; skippedZeroAmount: number };

        if (template) {
          // Use AI-detected template mapping
          console.log(`🤖 Using template "${template.bankName}" (header row ${template.headerRowIndex}, data from row ${template.dataStartRow})`);
          const result = parseTransactionsWithTemplate(rows, template);
          transactions = result.transactions;
          stats = result.stats;
        } else {
          // Auto-detect header row and column mapping
          const { headerRowIndex, columnMap } = findHeaders(rows);
          console.log(`✅ Auto-detected header at row ${headerRowIndex + 1}, columns:`, columnMap);

          const hasSeparate = ('entrate' in columnMap || 'uscite' in columnMap) && !('importo' in columnMap);
          if (hasSeparate) {
            // Colonne entrate/uscite separate → usa parseTransactionsWithTemplate
            const syntheticTemplate: BankTemplate = {
              id: 'auto',
              bankName: 'Auto',
              isDefault: false,
              createdAt: '',
              headerRowIndex,
              dataStartRow: headerRowIndex + 1,
              columns: columnMap as BankColumnMapping,
              importoType: 'separate',
              positiveIsEntrata: true,
              samplePreview: '',
            };
            const result = parseTransactionsWithTemplate(rows, syntheticTemplate);
            transactions = result.transactions;
            stats = result.stats;
          } else {
            // Colonna importo con segno → usa parseTransactions (con causale-based tipo)
            const result = parseTransactions(rows, headerRowIndex + 1, columnMap);
            transactions = result.transactions;
            stats = result.stats;
          }
        }

        resolve({ ...metadata, transactions, parsingStats: stats });
      } catch (err) {
        reject(new Error(`Errore nel parsing del file Excel: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Errore nella lettura del file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Utility to format period string from dates
export function formatPeriodo(dal?: string, al?: string): string {
  if (!dal && !al) return '';

  const mesi = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  if (dal && al) {
    const dalDate = new Date(dal);
    const alDate = new Date(al);

    if (dalDate.getMonth() === alDate.getMonth() && dalDate.getFullYear() === alDate.getFullYear()) {
      return `${mesi[dalDate.getMonth()]} ${dalDate.getFullYear()}`;
    }

    return `${mesi[dalDate.getMonth()]} - ${mesi[alDate.getMonth()]} ${alDate.getFullYear()}`;
  }

  const date = new Date(dal || al!);
  return `${mesi[date.getMonth()]} ${date.getFullYear()}`;
}
