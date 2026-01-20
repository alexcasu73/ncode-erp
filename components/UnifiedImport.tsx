import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, Lock } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { supabase } from '../lib/supabase';
import { unifiedImport } from '../lib/unified-import';
import { exportUnifiedExcel } from '../lib/import-export';
import type { Invoice, CashflowRecord, Customer, Deal } from '../types';

// Helper to convert camelCase to snake_case
const camelToSnake = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);

  return Object.keys(obj).reduce((acc: any, key: string) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = camelToSnake(obj[key]);
    return acc;
  }, {});
};

export const UnifiedImport: React.FC = () => {
  const { invoices, cashflowRecords, customers, deals, addCustomer, refreshData } = useData();
  const { companyId } = useAuth();
  const { canImport, loading: roleLoading } = useUserRole();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    stats: { invoicesImported: number; cashflowsImported: number; customersImported: number; dealsImported: number };
    errors: string[];
  } | null>(null);

  // Access control: only ADMIN and MANAGER can import
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Caricamento...</div>
      </div>
    );
  }

  if (!canImport) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <Lock size={48} className="mx-auto mb-4 text-red-600 dark:text-red-400" />
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-300 mb-2">Accesso Negato</h2>
          <p className="text-red-700 dark:text-red-400 mb-4">
            Non hai i permessi necessari per accedere all'importazione dati.
          </p>
          <p className="text-sm text-red-600 dark:text-red-500 mb-6">
            Solo gli amministratori e i manager possono importare dati nel sistema.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Torna Indietro
          </button>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const filename = `export-completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportUnifiedExcel(invoices, cashflowRecords, customers, deals, filename);
  };

  const handleUnifiedImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      // 1. Parse il file e crea il mapping degli ID
      const result = await unifiedImport(file);

      if (result.errors.length > 0) {
        console.warn('Import warnings:', result.errors);
      }

      if (!companyId) {
        throw new Error('Nessun company_id disponibile');
      }

      // 2. Importa i clienti
      let customersSuccess = 0;
      let customersErrors = 0;
      for (const customer of result.customers) {
        try {
          await addCustomer(customer as Customer);
          customersSuccess++;
        } catch (err) {
          customersErrors++;
          console.error('Errore import cliente:', err);
        }
      }

      // 3. Importa le fatture (con ID specifici, bypassando addInvoice)
      let invoicesSuccess = 0;
      let invoicesErrors = 0;
      for (const invoice of result.invoices) {
        try {
          const invoiceWithCompany = { ...invoice, companyId };
          const dataToInsert = camelToSnake(invoiceWithCompany);

          const { error } = await supabase
            .from('invoices')
            .insert(dataToInsert);

          if (error) {
            throw error;
          }

          invoicesSuccess++;
        } catch (err) {
          invoicesErrors++;
          console.error('Errore import fattura:', err);
        }
      }

      // 4. Importa i flussi (con ID specifici e invoice_id mappati, bypassando addCashflowRecord)
      let cashflowsSuccess = 0;
      let cashflowsErrors = 0;
      for (const cashflow of result.cashflows) {
        try {
          const cashflowWithCompany = { ...cashflow, companyId };
          const dataToInsert = camelToSnake(cashflowWithCompany);

          const { error } = await supabase
            .from('cashflow_records')
            .insert(dataToInsert);

          if (error) {
            throw error;
          }

          cashflowsSuccess++;
        } catch (err) {
          cashflowsErrors++;
          console.error('Errore import flusso:', err);
        }
      }

      // 5. Importa le opportunità (con ID specifici, bypassando addDeal)
      let dealsSuccess = 0;
      let dealsErrors = 0;
      for (const deal of result.deals) {
        try {
          const dealWithCompany = { ...deal, companyId };
          const dataToInsert = camelToSnake(dealWithCompany);

          const { error } = await supabase
            .from('deals')
            .insert(dataToInsert);

          if (error) {
            throw error;
          }

          dealsSuccess++;
        } catch (err) {
          dealsErrors++;
          console.error('Errore import opportunità:', err);
        }
      }

      // Refresh data to load imported records
      await refreshData();

      const totalErrors = customersErrors + invoicesErrors + cashflowsErrors + dealsErrors;
      const allErrors = [...result.errors];

      if (totalErrors > 0) {
        allErrors.push(`Errori database: ${totalErrors} record non importati`);
      }

      setImportResult({
        success: totalErrors === 0,
        stats: {
          invoicesImported: invoicesSuccess,
          cashflowsImported: cashflowsSuccess,
          customersImported: customersSuccess,
          dealsImported: dealsSuccess
        },
        errors: allErrors
      });

      console.log('✅ Import completo:', {
        clienti: `${customersSuccess}/${result.customers.length}`,
        fatture: `${invoicesSuccess}/${result.invoices.length}`,
        flussi: `${cashflowsSuccess}/${result.cashflows.length}`,
        opportunità: `${dealsSuccess}/${result.deals.length}`,
        mappingID: Object.keys(result.invoiceIdMap).length
      });

    } catch (err) {
      console.error('Errore import unificato:', err);
      setImportResult({
        success: false,
        stats: { invoicesImported: 0, cashflowsImported: 0, customersImported: 0, dealsImported: 0 },
        errors: [`Errore critico: ${err instanceof Error ? err.message : 'errore sconosciuto'}`]
      });
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-6" style={{ paddingBottom: '20px' }}>
      <div className="flex items-center gap-3 mb-4">
        <FileSpreadsheet className="text-primary" size={24} />
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Import Completo Dati</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Importa fatture, flussi di cassa e clienti da un unico file Excel
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">ℹ️ Come funziona</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>Esporta <strong>tutti i dati</strong> in un unico file Excel (4 fogli)</li>
          <li>Importa <strong>tutto in una volta</strong>: fatture, flussi, clienti e opportunità</li>
          <li><strong>Genera automaticamente nuovi ID</strong> per evitare conflitti</li>
          <li><strong>Mantiene i collegamenti</strong> tra fatture e flussi di cassa</li>
        </ul>
      </div>

      {/* Export Button */}
      <div className="mb-6">
        <button
          onClick={handleExport}
          disabled={invoices.length === 0 && cashflowRecords.length === 0 && customers.length === 0 && deals.length === 0}
          className="w-full bg-secondary text-white px-6 py-4 rounded-lg font-medium hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={24} />
          <div className="text-left">
            <div className="font-semibold">Esporta Tutti i Dati</div>
            <div className="text-sm opacity-90">
              {invoices.length} fatture • {cashflowRecords.length} flussi • {customers.length} clienti • {deals.length} opportunità
            </div>
          </div>
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-dark-card text-gray-500 dark:text-gray-400">oppure</span>
        </div>
      </div>

      {/* Import Button */}
      <div className="mb-6">
        <label className="block">
          <div className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all
            ${importing
              ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-wait'
              : 'border-primary dark:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10'
            }
          `}>
            <Upload className="mx-auto mb-3 text-primary" size={48} />
            <p className="text-lg font-medium text-dark dark:text-white mb-1">
              {importing ? 'Importazione in corso...' : 'Clicca per selezionare file Excel'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Formato: .xlsx o .xls
            </p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUnifiedImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`
          rounded-lg p-4 border
          ${importResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          }
        `}>
          <div className="flex items-start gap-3">
            {importResult.success ? (
              <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={24} />
            ) : (
              <AlertCircle className="text-orange-600 dark:text-orange-400 flex-shrink-0" size={24} />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${
                importResult.success
                  ? 'text-green-900 dark:text-green-300'
                  : 'text-orange-900 dark:text-orange-300'
              }`}>
                {importResult.success ? '✅ Import completato con successo!' : '⚠️ Import completato con avvisi'}
              </h3>

              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Fatture importate:</span>
                  <span className="font-medium text-dark dark:text-white">{importResult.stats.invoicesImported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Flussi importati:</span>
                  <span className="font-medium text-dark dark:text-white">{importResult.stats.cashflowsImported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Clienti importati:</span>
                  <span className="font-medium text-dark dark:text-white">{importResult.stats.customersImported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Opportunità importate:</span>
                  <span className="font-medium text-dark dark:text-white">{importResult.stats.dealsImported}</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-orange-800 dark:text-orange-200 font-medium">
                    Mostra {importResult.errors.length} avvisi/errori
                  </summary>
                  <ul className="mt-2 space-y-1 text-orange-700 dark:text-orange-300 list-disc list-inside max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
        <h3 className="font-semibold text-dark dark:text-white mb-3">📋 Come trasferire dati tra aziende</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-dark dark:text-white mb-2">1️⃣ Esporta dall'azienda di origine</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside ml-4">
              <li>Accedi all'azienda da cui vuoi esportare i dati</li>
              <li>Vai su "Import Dati" (questa pagina)</li>
              <li>Click su <strong>"Esporta Tutti i Dati"</strong></li>
              <li>Viene scaricato un file Excel con 4 fogli (Fatture, Flussi, Clienti, Opportunità)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-dark dark:text-white mb-2">2️⃣ Importa nell'azienda di destinazione</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside ml-4">
              <li>Fai logout e login nell'azienda di destinazione</li>
              <li>Vai su "Import Dati"</li>
              <li>Carica il file Excel appena scaricato</li>
              <li><strong>Gli ID vengono rigenerati automaticamente</strong></li>
              <li><strong>I collegamenti fatture-flussi vengono mantenuti</strong></li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ <strong>Non serve modificare il file Excel!</strong> Tutto viene gestito automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
