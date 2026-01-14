import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import XLSX from 'xlsx';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Converti numero Excel in data YYYY-MM-DD
function excelDateToISOString(excelDate) {
  if (!excelDate || excelDate === '') return null;
  if (typeof excelDate === 'string') return excelDate; // Già una stringa

  // Excel date: numero di giorni da 1/1/1900
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Converti ID fattura da "Fattura_202" a "202/2026"
function convertInvoiceId(oldId, anno) {
  if (!oldId || oldId === '') return null;
  const numero = oldId.replace('Fattura_', '');
  return `${numero}/${anno}`;
}

async function importFromExcel() {
  const filePath = '/Users/alessandrocasu/Downloads/BP-2026 Ncode Studio (1).xlsx';

  console.log('📂 Reading Excel file...\n');

  try {
    const workbook = XLSX.readFile(filePath);

    // === STEP 1: Import Customers ===
    console.log('👥 === IMPORTING CUSTOMERS ===\n');
    const customersSheet = workbook.Sheets['Anagrafiche clienti'];
    const customersData = XLSX.utils.sheet_to_json(customersSheet, { defval: '' });
    console.log(`Found ${customersData.length} customers\n`);

    let customersImported = 0;

    for (const row of customersData) {
      // Salta righe senza azienda
      if (!row['Azienda'] || row['Azienda'].trim() === '') {
        continue;
      }

      // Usa l'ID dal foglio o genera uno basato sull'azienda
      const customerId = row['ID'] ? `CUST-${row['ID']}` : `CUST-${row['Azienda'].replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;

      const customerData = {
        id: customerId,
        name: row['Contatto'] || row['Legale Rappresentante'] || '',
        company: row['Ragione sociale'] || row['Azienda'] || '',
        email: row['Email'] || '',
        status: 'Attivo',
        revenue: 0,
        vat_id: row['p.iva/codice fiscale'] || '',
        sdi_code: row['SDI'] || '',
        address: row['Sede'] || '',
        phone: row['Telefono'] || ''
      };

      const { error } = await supabase
        .from('customers')
        .insert(customerData);

      if (error) {
        console.error(`❌ Error importing customer ${customerId}:`, error.message);
      } else {
        customersImported++;
        if (customersImported % 10 === 0) {
          console.log(`   ✅ Imported ${customersImported} customers...`);
        }
      }
    }

    console.log(`\n✅ Imported ${customersImported}/${customersData.length} customers\n`);

    // === STEP 2: Import Invoices ===
    console.log('📄 === IMPORTING INVOICES ===\n');
    const invoicesSheet = workbook.Sheets['Fatturazione'];
    const invoicesData = XLSX.utils.sheet_to_json(invoicesSheet, { defval: '' });
    console.log(`Found ${invoicesData.length} invoices\n`);

    let invoicesImported = 0;
    const invoiceIdMap = new Map(); // Mappa vecchio ID -> nuovo ID

    for (const row of invoicesData) {
      const oldId = row['Id'];
      const anno = row['Anno'];
      const newId = convertInvoiceId(oldId, anno);

      if (!newId) {
        console.log(`⚠️  Skipping invoice with empty ID`);
        continue;
      }

      invoiceIdMap.set(oldId, newId);

      const dataISO = excelDateToISOString(row['Data']);

      const invoiceData = {
        id: newId,
        data: dataISO,
        mese: row['Mese'] || '',
        anno: anno || 2026,
        nome_progetto: row['Nome progetto'] || '',
        tipo: row['Tipo'] || 'Entrata',
        stato_fatturazione: row['Stato fatturazione'] || 'Stimato',
        spesa: row['Spesa'] || '',
        tipo_spesa: row['Tipo spesa'] || '',
        note: row['Note'] || '',
        flusso: parseFloat(row['Flusso']) || 0,
        iva: parseFloat(row['Iva ']) || 0,
        percentuale_iva: parseFloat(row['%iva']) || 0,
        percentuale_fatturazione: parseFloat(row['%fatturazione']) || 100,
        checked: row['Checked'] === true || row['Checked'] === 'true'
      };

      const { error } = await supabase
        .from('invoices')
        .insert(invoiceData);

      if (error) {
        console.error(`❌ Error importing invoice ${newId}:`, error.message);
      } else {
        invoicesImported++;
        if (invoicesImported % 50 === 0) {
          console.log(`   ✅ Imported ${invoicesImported} invoices...`);
        }
      }
    }

    console.log(`\n✅ Imported ${invoicesImported}/${invoicesData.length} invoices\n`);

    // === STEP 2: Import Cashflow Records ===
    console.log('💰 === IMPORTING CASHFLOW RECORDS ===\n');
    const cashflowSheet = workbook.Sheets['Cashflow'];
    const cashflowData = XLSX.utils.sheet_to_json(cashflowSheet, { defval: '' });
    console.log(`Found ${cashflowData.length} cashflow records\n`);

    let cashflowImported = 0;
    let cashflowCounter = 1;

    for (const row of cashflowData) {
      const oldInvoiceId = row['Fattura'];
      let newInvoiceId = null;
      let isStandalone = false;

      // Se c'è un riferimento a una fattura, cerca l'ID mappato
      if (oldInvoiceId && oldInvoiceId.trim() !== '') {
        newInvoiceId = invoiceIdMap.get(oldInvoiceId);
        if (!newInvoiceId) {
          console.log(`⚠️  Skipping cashflow: invoice ${oldInvoiceId} not found in map`);
          continue;
        }
      } else {
        // Movimento standalone (senza fattura)
        isStandalone = true;
        console.log(`📝 Creating standalone cashflow record`);
      }

      // Genera ID progressivo CF-0001, CF-0002, etc.
      const cashflowId = `CF-${String(cashflowCounter).padStart(4, '0')}`;
      cashflowCounter++;

      const dataISO = excelDateToISOString(row['Giorno']);

      const cashflowRecordData = {
        id: cashflowId,
        invoice_id: newInvoiceId, // null per movimenti standalone
        data_pagamento: dataISO,
        importo: parseFloat(row['Totale flusso']) || 0,
        note: row['Note'] || '',
        tipo: row['Tipo'] || 'Entrata',
        // Se è standalone, usa stato "Nessuno", altrimenti usa quello dal foglio
        stato_fatturazione: isStandalone ? 'Nessuno' : (row['Stato pagamento'] || 'Stimato')
      };

      const { error } = await supabase
        .from('cashflow_records')
        .insert(cashflowRecordData);

      if (error) {
        console.error(`❌ Error importing cashflow ${cashflowId}:`, error.message);
      } else {
        cashflowImported++;
        if (cashflowImported % 50 === 0) {
          console.log(`   ✅ Imported ${cashflowImported} cashflow records...`);
        }
      }
    }

    console.log(`\n✅ Imported ${cashflowImported}/${cashflowData.length} cashflow records\n`);

    console.log('\n🎉 IMPORT COMPLETE!\n');
    console.log(`📊 Summary:`);
    console.log(`   - Customers: ${customersImported} imported`);
    console.log(`   - Invoices: ${invoicesImported} imported`);
    console.log(`   - Cashflow records: ${cashflowImported} imported`);
    console.log(`   - Customer ID format: CUST-# (e.g., CUST-2)`);
    console.log(`   - Invoice ID format: numero/anno (e.g., 202/2026)`);
    console.log(`   - Cashflow ID format: CF-#### (e.g., CF-0001)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

importFromExcel();
