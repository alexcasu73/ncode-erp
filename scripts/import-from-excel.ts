import { readFile, utils } from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importFromExcel() {
  const filePath = '/Users/alessandrocasu/Downloads/BP-2026 Ncode Studio (1).xlsx';

  console.log('Reading Excel file...');
  const workbook = readFile(filePath);

  console.log('Available sheets:', workbook.SheetNames);

  // Import Fatturazione
  if (workbook.SheetNames.includes('Fatturazione')) {
    console.log('\nImporting Fatturazione...');
    const sheet = workbook.Sheets['Fatturazione'];
    const data = utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Fatturazione`);
    console.log('Sample row:', data[0]);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data as any[]) {
      try {
        const invoice = {
          id: row['ID'] || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          data: row['Data'] ? new Date(row['Data']).toISOString().split('T')[0] : null,
          mese: row['Mese'],
          anno: row['Anno'],
          nome_progetto: row['Nome progetto'] || '',
          tipo: row['Tipo'],
          stato_fatturazione: row['Stato fatturazione'],
          spesa: row['Spesa'] || '',
          tipo_spesa: row['Tipo spesa'] || '',
          note: row['Note'] || '',
          flusso: parseFloat(row['Flusso']) || 0,
          iva: parseFloat(row['Iva']) || 0,
          percentuale_iva: parseFloat(row['%iva']) || 0,
          percentuale_fatturazione: parseFloat(row['%fatturazione']) || 100,
          checked: row['Checked'] === true || row['Checked'] === 'TRUE'
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
      } catch (err: any) {
        console.error('Error processing row:', err.message);
        errorCount++;
      }
    }

    console.log(`Fatturazione import complete: ${successCount} success, ${errorCount} errors`);
  }

  // Import Cashflow
  if (workbook.SheetNames.includes('Cashflow')) {
    console.log('\nImporting Cashflow...');
    const sheet = workbook.Sheets['Cashflow'];
    const data = utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Cashflow`);
    console.log('Sample row:', data[0]);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data as any[]) {
      try {
        const cashflow = {
          id: row['ID'] || `CF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          invoice_id: row['Fattura'] || null,
          data: row['Data'] || row['Giorno'] ? new Date(row['Data'] || row['Giorno']).toISOString().split('T')[0] : null,
          mese: row['Mese'],
          anno: row['Anno'],
          nome_progetto: row['Progetto'] || row['Nome progetto'] || '',
          tipo: row['Tipo'],
          stato_fatturazione: row['Stato pagamento'] || row['Stato fatturazione'],
          spesa: row['Spesa'] || '',
          tipo_spesa: row['Tipo spesa'] || '',
          note: row['Note'] || '',
          flusso: parseFloat(row['Totale flusso'] || row['Flusso']) || 0,
          iva: parseFloat(row['Iva']) || 0,
          percentuale_iva: parseFloat(row['%iva']) || 0,
          percentuale_fatturazione: parseFloat(row['%fatturazione']) || 100,
          checked: row['Checked'] === true || row['Checked'] === 'TRUE'
        };

        const { error } = await supabase
          .from('cashflow_records')
          .insert(cashflow);

        if (error) {
          console.error('Error inserting cashflow:', cashflow.id, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error('Error processing row:', err.message);
        errorCount++;
      }
    }

    console.log(`Cashflow import complete: ${successCount} success, ${errorCount} errors`);
  }

  // Import Anagrafiche clienti
  if (workbook.SheetNames.includes('Anagrafiche clienti')) {
    console.log('\nImporting Anagrafiche clienti...');
    const sheet = workbook.Sheets['Anagrafiche clienti'];
    const data = utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Anagrafiche clienti`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data as any[]) {
      try {
        const customer = {
          id: row['ID'] || `C-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          console.error('Error inserting customer:', customer.name, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error('Error processing row:', err.message);
        errorCount++;
      }
    }

    console.log(`Customers import complete: ${successCount} success, ${errorCount} errors`);
  }

  console.log('\n✅ Import completed!');
}

importFromExcel().catch(console.error);
