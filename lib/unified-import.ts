import * as XLSX from 'xlsx';
import type { Invoice, CashflowRecord, Customer, Deal } from '../types';
import { DealStage } from '../types';

// Helper functions (copied from import-export.ts for standalone parsing)
function parseDate(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  }
  return undefined;
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Import unificato: importa fatture, flussi, clienti e opportunità da un unico file Excel
 * con 4 fogli (Fatture, Flussi di Cassa, Clienti, Opportunità)
 */
export async function unifiedImport(file: File): Promise<{
  invoices: Partial<Invoice>[];
  cashflows: Partial<CashflowRecord>[];
  customers: Partial<Customer>[];
  deals: Partial<Deal>[];
  invoiceIdMap: Record<string, string>;
  errors: string[];
  stats: {
    invoicesImported: number;
    cashflowsImported: number;
    customersImported: number;
    dealsImported: number;
  };
}> {
  const errors: string[] = [];
  const invoiceIdMap: Record<string, string> = {};

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Trova i fogli necessari
    const invoiceSheet = workbook.Sheets['Fatture'];
    const cashflowSheet = workbook.Sheets['Flussi di Cassa'];
    const customerSheet = workbook.Sheets['Clienti'];
    const dealSheet = workbook.Sheets['Opportunità'];

    if (!invoiceSheet) {
      errors.push('Foglio "Fatture" non trovato nel file Excel');
    }
    if (!cashflowSheet) {
      errors.push('Foglio "Flussi di Cassa" non trovato nel file Excel');
    }
    if (!customerSheet) {
      errors.push('Foglio "Clienti" non trovato nel file Excel');
    }
    if (!dealSheet) {
      errors.push('Foglio "Opportunità" non trovato nel file Excel');
    }

    // 1. Import clienti (generano sempre nuovi ID)
    const importedCustomers: Partial<Customer>[] = [];
    if (customerSheet) {
      const customerData = XLSX.utils.sheet_to_json(customerSheet);
      for (let i = 0; i < customerData.length; i++) {
        const row: any = customerData[i];
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) continue;

        try {
          const customer: Partial<Customer> = {
            id: `Cliente_${crypto.randomUUID()}`,
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
          importedCustomers.push(customer);
        } catch (err) {
          errors.push(`Cliente riga ${i + 2}: ${err instanceof Error ? err.message : 'errore'}`);
        }
      }
    }

    // 2. Import fatture con mapping degli ID
    const importedInvoices: Partial<Invoice>[] = [];
    if (invoiceSheet) {
      const invoiceData = XLSX.utils.sheet_to_json(invoiceSheet);
      for (let i = 0; i < invoiceData.length; i++) {
        const row: any = invoiceData[i];
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) continue;

        try {
          const oldId = row['ID'] || '';
          const newId = `Fattura_${crypto.randomUUID()}`;
          if (oldId) {
            invoiceIdMap[oldId] = newId;
          }

          const data = parseDate(row['Data']) || new Date().toISOString().split('T')[0];

          const invoice: Partial<Invoice> = {
            id: newId,
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
          importedInvoices.push(invoice);
        } catch (err) {
          errors.push(`Fattura riga ${i + 2}: ${err instanceof Error ? err.message : 'errore'}`);
        }
      }
    }

    // 3. Import flussi e aggiorna invoice_id usando la mappa
    const importedCashflows: Partial<CashflowRecord>[] = [];
    if (cashflowSheet) {
      const cashflowData = XLSX.utils.sheet_to_json(cashflowSheet);
      for (let i = 0; i < cashflowData.length; i++) {
        const row: any = cashflowData[i];
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) continue;

        try {
          const newCashflowId = `CF-${crypto.randomUUID()}`;
          const oldInvoiceId = row['ID Fattura'] || undefined;

          // Mappa il vecchio invoice_id al nuovo
          let mappedInvoiceId = oldInvoiceId;
          if (oldInvoiceId && invoiceIdMap[oldInvoiceId]) {
            mappedInvoiceId = invoiceIdMap[oldInvoiceId];
            console.log(`Mappato invoice_id: ${oldInvoiceId} -> ${mappedInvoiceId}`);
          }

          const cashflow: Partial<CashflowRecord> = {
            id: newCashflowId,
            invoiceId: mappedInvoiceId,
            dataPagamento: parseDate(row['Data Pagamento']),
            importo: parseNumber(row['Importo']),
            note: row['Note'] || '',
            statoFatturazione: ['Stimato', 'Effettivo', 'Nessuno'].includes(row['Stato']) ? row['Stato'] : undefined,
            tipo: row['Tipo'] === 'Entrata' || row['Tipo'] === 'Uscita' ? row['Tipo'] : undefined,
            descrizione: row['Descrizione'] || '',
            categoria: row['Categoria'] || '',
            createdAt: parseDate(row['Data Creazione']) || new Date().toISOString()
          };
          importedCashflows.push(cashflow);
        } catch (err) {
          errors.push(`Flusso riga ${i + 2}: ${err instanceof Error ? err.message : 'errore'}`);
        }
      }
    }

    // 4. Import opportunità (generano sempre nuovi ID)
    const importedDeals: Partial<Deal>[] = [];
    if (dealSheet) {
      const dealData = XLSX.utils.sheet_to_json(dealSheet);
      const validStages = ['Lead', 'Qualificazione', 'Proposta', 'Negoziazione', 'Vinto', 'Perso'];

      for (let i = 0; i < dealData.length; i++) {
        const row: any = dealData[i];
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) continue;

        try {
          const deal: Partial<Deal> = {
            id: `Deal_${crypto.randomUUID()}`,
            title: row['Titolo'] || '-',
            customerName: row['Cliente'] || '-',
            value: parseNumber(row['Valore']),
            stage: validStages.includes(row['Fase']) ? row['Fase'] as DealStage : DealStage.LEAD,
            probability: parseNumber(row['Probabilità']),
            expectedClose: parseDate(row['Chiusura Prevista']) || new Date().toISOString().split('T')[0]
          };
          importedDeals.push(deal);
        } catch (err) {
          errors.push(`Opportunità riga ${i + 2}: ${err instanceof Error ? err.message : 'errore'}`);
        }
      }
    }

    return {
      invoices: importedInvoices,
      cashflows: importedCashflows,
      customers: importedCustomers,
      deals: importedDeals,
      invoiceIdMap,
      errors,
      stats: {
        invoicesImported: importedInvoices.length,
        cashflowsImported: importedCashflows.length,
        customersImported: importedCustomers.length,
        dealsImported: importedDeals.length
      }
    };
  } catch (err) {
    errors.push(`Errore import unificato: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
    return {
      invoices: [],
      cashflows: [],
      customers: [],
      deals: [],
      invoiceIdMap: {},
      errors,
      stats: {
        invoicesImported: 0,
        cashflowsImported: 0,
        customersImported: 0,
        dealsImported: 0
      }
    };
  }
}
