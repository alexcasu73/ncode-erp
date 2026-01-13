import * as XLSX from 'xlsx';

export interface ParsedBankStatement {
  numeroConto?: string;
  dataAggiornamento?: string;
  saldoIniziale?: number;
  saldoFinale?: number;
  periodoDal?: string;
  periodoAl?: string;
  transactions: ParsedTransaction[];
}

export interface ParsedTransaction {
  data: string;           // YYYY-MM-DD
  dataValuta?: string;    // YYYY-MM-DD
  causale?: string;
  descrizione: string;
  importo: number;
  tipo: 'Entrata' | 'Uscita';
  saldo?: number;
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
    // Try DD/MM/YYYY or DD-MM-YYYY
    const match = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
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

// Find header row and column indices
function findHeaders(rows: any[][]): { headerRowIndex: number; columnMap: Record<string, number> } {
  const expectedHeaders = ['data op', 'data val', 'causale', 'descrizione', 'importo', 'saldo'];

  console.log('🔍 Searching for headers in first 15 rows...');

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;

    const normalizedRow = row.map(cell =>
      cell ? String(cell).toLowerCase().trim() : ''
    );

    // Check if this row contains enough header keywords
    let matchCount = 0;
    for (const header of expectedHeaders) {
      if (normalizedRow.some(cell => cell.includes(header))) {
        matchCount++;
      }
    }

    if (matchCount >= 3) {
      // Found header row, build column map
      const columnMap: Record<string, number> = {};

      for (let j = 0; j < normalizedRow.length; j++) {
        const cell = normalizedRow[j];
        if (cell.includes('data op')) columnMap.dataOp = j;
        else if (cell.includes('data val')) columnMap.dataVal = j;
        else if (cell.includes('causale')) columnMap.causale = j;
        else if (cell.includes('descrizione')) columnMap.descrizione = j;
        else if (cell.includes('importo')) columnMap.importo = j;
        else if (cell.includes('saldo')) columnMap.saldo = j;
      }

      console.log(`✅ Found headers at row ${i}:`, normalizedRow);
      console.log('📍 Column mapping:', columnMap);
      return { headerRowIndex: i, columnMap };
    }
  }

  // Default fallback (Crédit Agricole standard positions)
  console.log('⚠️ Headers not found, using default Crédit Agricole positions');
  return {
    headerRowIndex: 6, // Row 7 (0-indexed)
    columnMap: {
      dataOp: 0,
      dataVal: 1,
      causale: 2,
      descrizione: 3,
      importo: 4,
      saldo: 5
    }
  };
}

// Parse transactions from data rows
function parseTransactions(rows: any[][], startRow: number, columnMap: Record<string, number>): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  let skippedNoDate = 0;
  let skippedInvalidDate = 0;
  let skippedZeroAmount = 0;
  let consecutiveEmptyRows = 0;

  console.log(`📊 Parsing transactions starting from row ${startRow}, total rows: ${rows.length}`);
  console.log('Column mapping:', columnMap);

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];

    // Stop if we hit 3 consecutive empty rows (likely end of transactions)
    if (!row || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows >= 3) {
        console.log(`🛑 Stopped at row ${i}: 3 consecutive empty rows (end of transactions)`);
        break;
      }
      continue;
    }

    consecutiveEmptyRows = 0;

    // Skip rows without date (but don't count them as empty)
    const dataOp = row[columnMap.dataOp];
    if (!dataOp) {
      skippedNoDate++;
      continue;
    }

    const parsedDate = parseDate(dataOp);
    if (!parsedDate) {
      skippedInvalidDate++;
      console.log(`⚠️ Row ${i}: Invalid date format:`, dataOp);
      continue;
    }

    const importo = parseAmount(row[columnMap.importo]);
    if (importo === 0) {
      skippedZeroAmount++;
      console.log(`⚠️ Row ${i}: Zero amount, raw value:`, row[columnMap.importo]);
      continue;
    }

    const transaction: ParsedTransaction = {
      data: parsedDate,
      dataValuta: parseDate(row[columnMap.dataVal]),
      causale: row[columnMap.causale] ? String(row[columnMap.causale]).trim() : undefined,
      descrizione: row[columnMap.descrizione] ? String(row[columnMap.descrizione]).trim() : '',
      importo: Math.abs(importo),
      tipo: importo >= 0 ? 'Entrata' : 'Uscita',
      saldo: row[columnMap.saldo] !== undefined ? parseAmount(row[columnMap.saldo]) : undefined
    };

    transactions.push(transaction);
  }

  console.log(`✅ Parsed ${transactions.length} transactions`);
  console.log(`⏭️  Skipped: ${skippedNoDate} (no date), ${skippedInvalidDate} (invalid date), ${skippedZeroAmount} (zero amount)`);

  return transactions;
}

// Main parser function
export function parseBankStatementExcel(file: File): Promise<ParsedBankStatement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        // Get first sheet (usually "Lista Movimenti")
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Get the actual range of the sheet
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        console.log(`📐 Original sheet range: ${sheet['!ref']}, rows: ${range.e.r + 1}`);

        // FORCE reading up to row 200 to capture all transactions (Crédit Agricole files can have gaps)
        const forceRange = `A1:L200`;
        console.log(`🔧 Forcing extended range: ${forceRange}`);

        // Convert to 2D array with extended range to avoid stopping at empty rows
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
          range: forceRange
        }) as any[][];

        console.log(`📄 Excel file "${file.name}" - Total rows read: ${rows.length}`);
        console.log('First 10 rows:', rows.slice(0, 10));

        // Extract metadata from header rows
        const metadata = extractMetadata(rows);

        // Header is ALWAYS at row 9 (index 8) for Crédit Agricole
        const headerRowIndex = 8;
        const headerRow = rows[headerRowIndex];

        if (!headerRow) {
          throw new Error('Header row (row 9) not found in Excel file');
        }

        // Build column map from row 9
        const columnMap: Record<string, number> = {};
        const normalizedHeader = headerRow.map(cell =>
          cell ? String(cell).toLowerCase().trim() : ''
        );

        for (let j = 0; j < normalizedHeader.length; j++) {
          const cell = normalizedHeader[j];
          if (cell.includes('data op')) columnMap.dataOp = j;
          else if (cell.includes('data val')) columnMap.dataVal = j;
          else if (cell.includes('causale')) columnMap.causale = j;
          else if (cell.includes('descrizione')) columnMap.descrizione = j;
          else if (cell.includes('importo')) columnMap.importo = j;
          else if (cell.includes('saldo')) columnMap.saldo = j;
        }

        console.log(`✅ Using fixed header at row 9 (index 8):`, normalizedHeader);
        console.log('📍 Column mapping:', columnMap);

        // Parse transactions starting from row 10 (index 9)
        const transactions = parseTransactions(rows, headerRowIndex + 1, columnMap);

        const result: ParsedBankStatement = {
          ...metadata,
          transactions
        };

        resolve(result);
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
