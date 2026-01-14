import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importFromExcel() {
  const filePath = '/Users/alessandrocasu/Downloads/BP-2026 Ncode Studio (1).xlsx';

  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);

  console.log('Available sheets:', workbook.SheetNames);

  // Import Fatturazione - 295 invoices
  if (workbook.SheetNames.includes('Fatturazione')) {
    console.log('\n=== Importing Fatturazione ===');
    const sheet = workbook.Sheets['Fatturazione'];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Fatturazione`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Skip empty rows
        if (!row['Id']) continue;

        const invoice = {
          id: row['Id'],  // "Fattura_xyz"
          data: row['Data'] ? new Date(Math.round((row['Data'] - 25569) * 86400 * 1000)).toISOString().split('T')[0] : null,
          mese: row['Mese'],
          anno: row['Anno'],
          nome_progetto: row['Nome progetto'] || '',
          tipo: row['Tipo'],
          stato_fatturazione: row['Stato fatturazione'],
          spesa: row['Spesa'] || '',
          tipo_spesa: row['Tipo spesa'] || '',
          note: row['Note'] || '',
          flusso: parseFloat(row['Flusso']) || 0,
          iva: parseFloat(row['Iva ']) || parseFloat(row['Iva']) || 0,  // Note: "Iva " has a space
          percentuale_iva: parseFloat(row['%iva']) || 0,
          percentuale_fatturazione: parseFloat(row['%fatturazione']) || 100,
          checked: row['Checked'] === true || row['Checked'] === 'TRUE' || row['Checked'] === 1
        };

        const { error } = await supabase
          .from('invoices')
          .insert(invoice);

        if (error) {
          console.error('Error inserting invoice:', invoice.id, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('Error processing row:', err.message);
        errorCount++;
      }
    }

    console.log(`✅ Fatturazione import: ${successCount} success, ${errorCount} errors`);
  }

  // Import Cashflow - 302 records (some may not have invoice_id)
  if (workbook.SheetNames.includes('Cashflow')) {
    console.log('\n=== Importing Cashflow ===');
    const sheet = workbook.Sheets['Cashflow'];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Cashflow`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Skip empty rows
        if (!row['Tipo'] && !row['Totale flusso']) {
          skippedCount++;
          continue;
        }

        const cashflow = {
          id: row['ID'] ? row['ID'].toString() : `CF-${Date.now()}-${i}`,
          invoice_id: row['Fattura'] || null,  // Keep the invoice reference
          data: row['Giorno'] ? new Date(Math.round((row['Giorno'] - 25569) * 86400 * 1000)).toISOString().split('T')[0] : null,
          mese: row['Mese'],
          anno: row['Anno'],
          nome_progetto: row['Progetto'] || '',
          tipo: row['Tipo'],
          stato_fatturazione: row['Stato pagamento'],
          spesa: row['Spesa'] || '',
          tipo_spesa: row['Tipo spesa'] || '',
          note: row['Note'] || '',
          flusso: parseFloat(row['Totale flusso']) || 0,
          iva: 0,
          percentuale_iva: 0,
          percentuale_fatturazione: 100,
          checked: row['Checked'] === true || row['Checked'] === 'TRUE' || row['Checked'] === 1
        };

        const { error } = await supabase
          .from('cashflow_records')
          .insert(cashflow);

        if (error) {
          console.error(`Error inserting cashflow ${i+1}:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing cashflow row ${i+1}:`, err.message);
        errorCount++;
      }
    }

    console.log(`✅ Cashflow import: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);
  }

  // Import Anagrafiche clienti
  if (workbook.SheetNames.includes('Anagrafiche clienti')) {
    console.log('\n=== Importing Anagrafiche clienti ===');
    const sheet = workbook.Sheets['Anagrafiche clienti'];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Anagrafiche clienti`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Skip empty rows
        if (!row['Azienda'] && !row['Ragione sociale']) continue;

        const customer = {
          id: row['ID'] ? row['ID'].toString() : `C-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: row['Contatto'] || row['Azienda'] || '',
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
          .insert(customer);

        if (error) {
          console.error('Error inserting customer:', customer.company, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('Error processing customer row:', err.message);
        errorCount++;
      }
    }

    console.log(`✅ Customers import: ${successCount} success, ${errorCount} errors`);
  }

  console.log('\n🎉 Import completed!');

  // Final counts
  const invoicesCount = await supabase.from('invoices').select('count', { count: 'exact', head: true });
  const cashflowCount = await supabase.from('cashflow_records').select('count', { count: 'exact', head: true });
  const customersCount = await supabase.from('customers').select('count', { count: 'exact', head: true });

  console.log('\n📊 Final Database Counts:');
  console.log(`   Fatture: ${invoicesCount.count}`);
  console.log(`   Cashflow: ${cashflowCount.count}`);
  console.log(`   Clienti: ${customersCount.count}`);
}

importFromExcel().catch(console.error);
