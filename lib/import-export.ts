import * as XLSX from 'xlsx';
import type { Invoice, CashflowRecord, Customer, Deal } from '../types';

// ==================== EXPORT FUNCTIONS ====================

/**
 * Export invoices to Excel
 */
export function exportInvoicesToExcel(invoices: Invoice[], filename: string = 'fatture.xlsx') {
  const data = invoices.map(inv => ({
    'ID': inv.id,
    'Data': inv.data instanceof Date ? inv.data.toISOString().split('T')[0] : inv.data,
    'Data Scadenza': inv.dataScadenza ? (inv.dataScadenza instanceof Date ? inv.dataScadenza.toISOString().split('T')[0] : inv.dataScadenza) : '',
    'Mese': inv.mese,
    'Anno': inv.anno,
    'Progetto': inv.nomeProgetto,
    'Tipo': inv.tipo,
    'Stato': inv.statoFatturazione,
    'Spesa': inv.spesa,
    'Tipo Spesa': inv.tipoSpesa,
    'Note': inv.note,
    'Importo Netto': inv.flusso,
    'IVA': inv.iva,
    '% IVA': inv.percentualeIva,
    '% Fatturazione': inv.percentualeFatturazione,
    'Checked': inv.checked ? 'Sì' : 'No'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatture');

  // Auto-size columns
  const maxWidth = data.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
  worksheet['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 15 }));

  XLSX.writeFile(workbook, filename);
}

/**
 * Export cashflow records to Excel
 */
export function exportCashflowToExcel(cashflows: CashflowRecord[], filename: string = 'flussi-cassa.xlsx') {
  const data = cashflows.map(cf => ({
    'ID': cf.id,
    'ID Fattura': cf.invoiceId || '',
    'Data Pagamento': cf.dataPagamento || '',
    'Importo': cf.importo || 0,
    'Note': cf.note || '',
    'Stato': cf.statoFatturazione || '',
    'Tipo': cf.tipo || '',
    'Descrizione': cf.descrizione || '',
    'Categoria': cf.categoria || '',
    'Data Creazione': cf.createdAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Flussi di Cassa');

  worksheet['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 15 }));

  XLSX.writeFile(workbook, filename);
}

/**
 * Export customers to Excel
 */
export function exportCustomersToExcel(customers: Customer[], filename: string = 'clienti.xlsx') {
  const data = customers.map(cust => ({
    'ID': cust.id,
    'Nome': cust.name,
    'Azienda': cust.company,
    'Email': cust.email,
    'Stato': cust.status,
    'Ricavi': cust.revenue,
    'P.IVA': cust.vatId,
    'Codice SDI': cust.sdiCode,
    'Indirizzo': cust.address,
    'Telefono': cust.phone
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clienti');

  worksheet['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));

  XLSX.writeFile(workbook, filename);
}

// ==================== IMPORT FUNCTIONS ====================

/**
 * Parse date from various formats
 */
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

/**
 * Parse number from string or number
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Import invoices from Excel
 */
export async function importInvoicesFromExcel(file: File): Promise<{ invoices: Partial<Invoice>[], errors: string[] }> {
  const errors: string[] = [];
  const invoices: Partial<Invoice>[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // Excel row number (accounting for header)

      try {
        // Skip completely empty rows
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) {
          continue; // Skip silently
        }

        // Parse date, use today's date if missing or invalid
        const data = parseDate(row['Data']) || new Date().toISOString().split('T')[0];

        const invoice: Partial<Invoice> = {
          id: row['ID'] || `Fattura_${crypto.randomUUID()}`,
          data,
          dataScadenza: parseDate(row['Data Scadenza']),
          mese: row['Mese'] || '',
          anno: parseInt(row['Anno']) || new Date(data).getFullYear(),
          nomeProgetto: row['Progetto'] || '-',
          tipo: row['Tipo'] === 'Entrata' || row['Tipo'] === 'Uscita' ? row['Tipo'] : 'Entrata',
          statoFatturazione: ['Stimato', 'Effettivo', 'Nessuno'].includes(row['Stato']) ? row['Stato'] : 'Stimato',
          spesa: row['Spesa'] || '',
          tipoSpesa: row['Tipo Spesa'] || '',
          note: row['Note'] || '',
          flusso: parseNumber(row['Importo Netto']),
          iva: parseNumber(row['IVA']),
          percentualeIva: parseNumber(row['% IVA']),
          percentualeFatturazione: parseNumber(row['% Fatturazione']),
          checked: row['Checked'] === 'Sì' || row['Checked'] === true
        };

        invoices.push(invoice);
      } catch (err) {
        errors.push(`Riga ${rowNum}: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
      }
    }
  } catch (err) {
    errors.push(`Errore lettura file: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
  }

  return { invoices, errors };
}

/**
 * Import cashflow records from Excel
 */
export async function importCashflowFromExcel(file: File): Promise<{ cashflows: Partial<CashflowRecord>[], errors: string[] }> {
  const errors: string[] = [];
  const cashflows: Partial<CashflowRecord>[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2;

      try {
        // Skip completely empty rows
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) {
          continue; // Skip silently
        }

        const cashflow: Partial<CashflowRecord> = {
          id: row['ID'] || `CF-${crypto.randomUUID()}`,
          invoiceId: row['ID Fattura'] || undefined,
          dataPagamento: parseDate(row['Data Pagamento']),
          importo: parseNumber(row['Importo']),
          note: row['Note'] || '',
          statoFatturazione: ['Stimato', 'Effettivo', 'Nessuno'].includes(row['Stato']) ? row['Stato'] : undefined,
          tipo: row['Tipo'] === 'Entrata' || row['Tipo'] === 'Uscita' ? row['Tipo'] : undefined,
          descrizione: row['Descrizione'] || '',
          categoria: row['Categoria'] || '',
          createdAt: parseDate(row['Data Creazione']) || new Date().toISOString()
        };

        cashflows.push(cashflow);
      } catch (err) {
        errors.push(`Riga ${rowNum}: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
      }
    }
  } catch (err) {
    errors.push(`Errore lettura file: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
  }

  return { cashflows, errors };
}

/**
 * Import customers from Excel
 */
export async function importCustomersFromExcel(file: File): Promise<{ customers: Partial<Customer>[], errors: string[] }> {
  const errors: string[] = [];
  const customers: Partial<Customer>[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2;

      try {
        // Skip completely empty rows (all values are empty/null/undefined)
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) {
          continue; // Skip silently
        }

        // Fill empty required fields with "-"
        const customer: Partial<Customer> = {
          id: row['ID'] || `Cliente_${crypto.randomUUID()}`,
          name: row['Nome'] || '-',
          company: row['Azienda'] || '-',
          email: row['Email'] || '-',
          status: ['Attivo', 'Prospetto', 'Inattivo'].includes(row['Stato']) ? row['Stato'] : 'Attivo',
          revenue: parseNumber(row['Ricavi']),
          vatId: row['P.IVA'] || '',
          sdiCode: row['Codice SDI'] || '',
          address: row['Indirizzo'] || '',
          phone: row['Telefono'] || ''
        };

        customers.push(customer);
      } catch (err) {
        errors.push(`Riga ${rowNum}: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
      }
    }
  } catch (err) {
    errors.push(`Errore lettura file: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
  }

  return { customers, errors };
}

/**
 * Export unificato: esporta fatture, flussi, clienti e opportunità in un unico file Excel
 */
export function exportUnifiedExcel(
  invoices: Invoice[],
  cashflows: CashflowRecord[],
  customers: Customer[],
  deals: Deal[],
  filename: string = 'export-completo.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Fatture
  const invoiceData = invoices.map(inv => ({
    'ID': inv.id,
    'Data': inv.data instanceof Date ? inv.data.toISOString().split('T')[0] : inv.data,
    'Data Scadenza': inv.dataScadenza ? (inv.dataScadenza instanceof Date ? inv.dataScadenza.toISOString().split('T')[0] : inv.dataScadenza) : '',
    'Mese': inv.mese,
    'Anno': inv.anno,
    'Progetto': inv.nomeProgetto,
    'Tipo': inv.tipo,
    'Stato': inv.statoFatturazione,
    'Spesa': inv.spesa,
    'Tipo Spesa': inv.tipoSpesa,
    'Note': inv.note,
    'Importo Netto': inv.flusso,
    'IVA': inv.iva,
    '% IVA': inv.percentualeIva,
    '% Fatturazione': inv.percentualeFatturazione,
    'Checked': inv.checked ? 'Sì' : 'No'
  }));
  const worksheetInvoices = XLSX.utils.json_to_sheet(invoiceData);
  worksheetInvoices['!cols'] = Object.keys(invoiceData[0] || {}).map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(workbook, worksheetInvoices, 'Fatture');

  // Sheet 2: Flussi di Cassa
  const cashflowData = cashflows.map(cf => ({
    'ID': cf.id,
    'ID Fattura': cf.invoiceId || '',
    'Data Pagamento': cf.dataPagamento || '',
    'Importo': cf.importo || 0,
    'Note': cf.note || '',
    'Stato': cf.statoFatturazione || '',
    'Tipo': cf.tipo || '',
    'Descrizione': cf.descrizione || '',
    'Categoria': cf.categoria || '',
    'Data Creazione': cf.createdAt || ''
  }));
  const worksheetCashflow = XLSX.utils.json_to_sheet(cashflowData);
  worksheetCashflow['!cols'] = Object.keys(cashflowData[0] || {}).map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(workbook, worksheetCashflow, 'Flussi di Cassa');

  // Sheet 3: Clienti
  const customerData = customers.map(cust => ({
    'ID': cust.id,
    'Nome': cust.name,
    'Azienda': cust.company,
    'Email': cust.email,
    'Stato': cust.status,
    'Ricavi': cust.revenue,
    'P.IVA': cust.vatId,
    'Codice SDI': cust.sdiCode,
    'Indirizzo': cust.address,
    'Telefono': cust.phone
  }));
  const worksheetCustomers = XLSX.utils.json_to_sheet(customerData);
  worksheetCustomers['!cols'] = Object.keys(customerData[0] || {}).map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(workbook, worksheetCustomers, 'Clienti');

  // Sheet 4: Opportunità
  const dealData = deals.map(deal => ({
    'ID': deal.id,
    'Titolo': deal.title,
    'Cliente': deal.customerName,
    'Valore': deal.value,
    'Fase': deal.stage,
    'Probabilità': deal.probability,
    'Chiusura Prevista': deal.expectedClose
  }));
  const worksheetDeals = XLSX.utils.json_to_sheet(dealData);
  worksheetDeals['!cols'] = Object.keys(dealData[0] || {}).map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(workbook, worksheetDeals, 'Opportunità');

  XLSX.writeFile(workbook, filename);
}

export default {
  exportInvoicesToExcel,
  exportCashflowToExcel,
  exportCustomersToExcel,
  exportUnifiedExcel,
  importInvoicesFromExcel,
  importCashflowFromExcel,
  importCustomersFromExcel
};
