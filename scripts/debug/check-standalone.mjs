import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
});

async function checkStandalone() {
  try {
    // Movimenti standalone (senza invoiceId)
    const result = await pool.query(`
      SELECT
        id,
        invoice_id,
        data_pagamento,
        importo,
        note,
        tipo,
        stato_fatturazione,
        created_at
      FROM cashflow_records
      WHERE invoice_id IS NULL
      ORDER BY data_pagamento DESC
      LIMIT 20
    `);

    console.log('📊 Movimenti Standalone:', result.rows.length);
    console.log('');

    if (result.rows.length === 0) {
      console.log('❌ Nessun movimento standalone trovato');
    } else {
      result.rows.forEach((mov, i) => {
        console.log(`${i + 1}. Data: ${mov.data_pagamento}`);
        console.log(`   Tipo: ${mov.tipo || 'N/A'}`);
        console.log(`   Stato: ${mov.stato_fatturazione || '⚠️  MANCANTE!'}`);
        console.log(`   Importo: €${mov.importo || 0}`);
        console.log(`   Note: ${mov.note || 'N/A'}`);
        console.log('');
      });

      // Conta quanti non hanno stato
      const senzaStato = result.rows.filter(m => !m.stato_fatturazione);
      if (senzaStato.length > 0) {
        console.log(`⚠️  ${senzaStato.length} movimenti standalone SENZA stato_fatturazione!`);
      }
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

checkStandalone();
