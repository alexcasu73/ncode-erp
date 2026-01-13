// Script per importare i record di cashflow dal Google Sheet
// Esegui con: node scripts/import-cashflow.js

import { createClient } from '@supabase/supabase-js';

// Configura Supabase
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(supabaseUrl, supabaseKey);

// URL del Google Sheet (export CSV)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/16EbE-2i_wd4Jhbxjm734vi6FtX3brsO98pS-LlQpszE/gviz/tq?tqx=out:csv&sheet=Cashflow';

async function fetchCSV(url) {
  const response = await fetch(url);
  return response.text();
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header.trim()] = values[index]?.trim() || '';
    });
    records.push(record);
  }

  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Formato: DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function importCashflow() {
  console.log('📥 Scaricando dati dal Google Sheet...');

  const csvText = await fetchCSV(SHEET_URL);
  const records = parseCSV(csvText);

  console.log(`📊 Trovati ${records.length} record nel foglio Cashflow`);

  // Prima elimina tutti i record esistenti
  console.log('🗑️ Eliminando record esistenti...');
  const { error: deleteError } = await supabase
    .from('cashflow_records')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Elimina tutti

  if (deleteError) {
    console.error('Errore durante eliminazione:', deleteError.message);
  }

  // Prepara i record da inserire
  const cashflowRecords = records
    .filter(r => r['Fattura']) // Solo record con riferimento fattura
    .map(r => ({
      invoice_id: r['Fattura'],
      data_pagamento: parseDate(r['Giorno']),
      note: r['Note'] || null,
    }));

  console.log(`📝 Preparati ${cashflowRecords.length} record per l'inserimento`);

  // Inserisci in batch da 50
  const batchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < cashflowRecords.length; i += batchSize) {
    const batch = cashflowRecords.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('cashflow_records')
      .insert(batch);

    if (error) {
      console.error(`❌ Errore batch ${i}-${i + batch.length}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ Inseriti record ${i + 1}-${i + batch.length}`);
    }
  }

  console.log('\n========================================');
  console.log(`✅ Importazione completata!`);
  console.log(`   Record inseriti: ${inserted}`);
  console.log(`   Errori: ${errors}`);
  console.log('========================================');
}

importCashflow().catch(console.error);
