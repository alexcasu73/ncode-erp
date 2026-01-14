import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Download, Printer, Filter, Building2, TrendingUp, TrendingDown, Scale, Edit2, Plus, X, Check } from 'lucide-react';
import { FinancialItem } from '../types';
import { formatCurrency, formatCurrencyNoDecimals } from '../lib/currency';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const FinancialStatement: React.FC = () => {
  const {
    financialItems,
    invoices,
    loading,
    addFinancialItem,
    updateFinancialItem,
    deleteFinancialItem
  } = useData();

  const [activeTab, setActiveTab] = useState<'balance' | 'income'>('balance');
  const [filterStato, setFilterStato] = useState<'Stimato' | 'Effettivo'>('Effettivo');
  const [filterAnno, setFilterAnno] = useState<number>(new Date().getFullYear());
  const [editingItem, setEditingItem] = useState<FinancialItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState<Partial<FinancialItem>>({});

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  // Calcola dati reali dal Conto Economico basato su fatture
  const incomeStatementData = useMemo(() => {
    // Filtra fatture per anno e stato
    const filteredInvoices = invoices.filter(inv => {
      return inv.anno === filterAnno && inv.statoFatturazione === filterStato;
    });

    // Calcola Entrate (Valore della Produzione)
    const entrate = filteredInvoices
      .filter(inv => inv.tipo === 'Entrata')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    // Calcola Uscite (Costi della Produzione)
    const uscite = filteredInvoices
      .filter(inv => inv.tipo === 'Uscita')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    const risultatoOperativo = entrate - uscite;
    const margine = entrate > 0 ? (risultatoOperativo / entrate) * 100 : 0;

    return {
      entrate,
      uscite,
      risultatoOperativo,
      margine
    };
  }, [invoices, filterAnno, filterStato]);

  // Helper calculations per Stato Patrimoniale (da financialItems editabili)
  const assets = financialItems.filter(i => i.section === 'Stato Patrimoniale' && i.category === 'Attivo');
  const liabilities = financialItems.filter(i => i.section === 'Stato Patrimoniale' && i.category === 'Passivo');

  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
  const equityGap = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark dark:text-white">Bilancio</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Stato Patrimoniale e Conto Economico</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filtro Anno */}
          <div className="bg-white dark:bg-dark-card rounded-lg p-2 flex items-center border border-gray-200 dark:border-dark-border" shadow-sm>
            <select
              value={filterAnno}
              onChange={(e) => setFilterAnno(Number(e.target.value))}
              className="border-none outline-none bg-transparent text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer"
            >
              {[2024, 2025, 2026].map(anno => (
                <option key={anno} value={anno}>{anno}</option>
              ))}
            </select>
          </div>

          {/* Filtro Stato (solo per Conto Economico) */}
          {activeTab === 'income' && (
            <div className="bg-white dark:bg-dark-card rounded-lg p-2 flex items-center border border-gray-200 dark:border-dark-border" shadow-sm>
              <select
                value={filterStato}
                onChange={(e) => setFilterStato(e.target.value as 'Stimato' | 'Effettivo')}
                className="border-none outline-none bg-transparent text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer"
              >
                <option value="Effettivo">Effettivo</option>
                <option value="Stimato">Stimato</option>
              </select>
            </div>
          )}

           <button className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 pl-4 pr-12 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors flex items-center gap-2" shadow-sm>
                <Printer size={18} />
                Stampa
            </button>
            <button className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm">
                <Download size={18} />
                Esporta PDF
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white dark:bg-dark-card rounded-lg w-fit border border-gray-200 dark:border-dark-border" shadow-sm>
        <button
          onClick={() => setActiveTab('balance')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'balance' ? 'bg-dark dark:bg-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white'
          }`}
        >
          Stato Patrimoniale
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'income' ? 'bg-dark dark:bg-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white'
          }`}
        >
          Conto Economico
        </button>
      </div>

      {/* Content */}
      {activeTab === 'balance' ? (
        <>
          {/* Balance Sheet KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-t-4 border-green-500" shadow-sm>
                <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                    <Building2 size={18} />
                    <h3 className="text-sm font-medium">Totale Attivo</h3>
                </div>
                <p className="text-3xl font-bold text-dark dark:text-white">{formatCurrencyNoDecimals(totalAssets)}</p>
            </div>
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-t-4 border-red-400" shadow-sm>
                <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                    <Scale size={18} />
                    <h3 className="text-sm font-medium">Totale Passivo</h3>
                </div>
                <p className="text-3xl font-bold text-dark dark:text-white">{formatCurrencyNoDecimals(totalLiabilities)}</p>
            </div>
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-t-4 border-primary" shadow-sm>
                <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                    <TrendingUp size={18} />
                    <h3 className="text-sm font-medium">Utile d'Esercizio (Calc)</h3>
                </div>
                <p className="text-3xl font-bold text-dark dark:text-white">{formatCurrencyNoDecimals(equityGap)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attivo */}
            <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden h-full" shadow-sm>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border bg-green-50/50 dark:bg-green-900/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-dark dark:text-white">Attivo</h3>
                <button
                  onClick={() => {
                    setNewItemForm({
                      section: 'Stato Patrimoniale',
                      category: 'Attivo',
                      name: '',
                      amount: 0
                    });
                    setIsAddingItem(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:opacity-90 transition-all shadow-sm"
                >
                  <Plus size={14} />
                  Aggiungi
                </button>
              </div>
              <div className="p-6">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Nessuna voce. Clicca "Aggiungi" per inserire voci.
                        </td>
                      </tr>
                    ) : (
                      assets.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg group">
                          <td className="py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{item.name}</td>
                          <td className="py-3 whitespace-nowrap text-right text-sm font-bold text-dark dark:text-white">{formatCurrencyNoDecimals(item.amount)}</td>
                          <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-dark-bg rounded text-gray-500 dark:text-gray-400"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Eliminare questa voce?')) {
                                  deleteFinancialItem(item.id);
                                }
                              }}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 ml-1"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-gray-50 dark:bg-gray-800/20">
                      <td className="py-4 pl-2 text-base font-bold text-dark dark:text-white">Totale Attivo</td>
                      <td colSpan={2} className="py-4 pr-2 text-right text-base font-bold text-green-600 dark:text-green-400">
                        {formatCurrencyNoDecimals(totalAssets)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Passivo */}
            <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden h-full" shadow-sm>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border bg-red-50/50 dark:bg-red-900/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-dark dark:text-white">Passivo e Netto</h3>
                <button
                  onClick={() => {
                    setNewItemForm({
                      section: 'Stato Patrimoniale',
                      category: 'Passivo',
                      name: '',
                      amount: 0
                    });
                    setIsAddingItem(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:opacity-90 transition-all shadow-sm"
                >
                  <Plus size={14} />
                  Aggiungi
                </button>
              </div>
              <div className="p-6">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {liabilities.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Nessuna voce. Clicca "Aggiungi" per inserire voci.
                        </td>
                      </tr>
                    ) : (
                      liabilities.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg group">
                          <td className="py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{item.name}</td>
                          <td className="py-3 whitespace-nowrap text-right text-sm font-bold text-dark dark:text-white">{formatCurrencyNoDecimals(item.amount)}</td>
                          <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-dark-bg rounded text-gray-500 dark:text-gray-400"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Eliminare questa voce?')) {
                                  deleteFinancialItem(item.id);
                                }
                              }}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 ml-1"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                     <tr className="bg-primary/20 dark:bg-primary/10">
                      <td className="py-3 pl-2 text-sm font-bold text-dark dark:text-white">Utile d'Esercizio (Corrente)</td>
                      <td colSpan={2} className="py-3 pr-2 text-right text-sm font-bold text-dark dark:text-white">
                        {formatCurrencyNoDecimals(equityGap)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/20">
                      <td className="py-4 pl-2 text-base font-bold text-dark dark:text-white">Totale a Pareggio</td>
                      <td colSpan={2} className="py-4 pr-2 text-right text-base font-bold text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(totalLiabilities + equityGap)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
        {/* Income Statement KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-l-4 border-green-500" shadow-sm>
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Valore della Produzione (Entrate)</h3>
                <p className="text-3xl font-bold text-dark dark:text-white mt-2">
                  {formatCurrency(incomeStatementData.entrate)}
                </p>
            </div>
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-l-4 border-red-400" shadow-sm>
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Costi della Produzione (Uscite)</h3>
                <p className="text-3xl font-bold text-dark dark:text-white mt-2">
                  {formatCurrency(incomeStatementData.uscite)}
                </p>
            </div>
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl border-l-4 border-primary" shadow-sm>
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Risultato Operativo</h3>
                <p className={`text-3xl font-bold mt-2 ${incomeStatementData.risultatoOperativo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(incomeStatementData.risultatoOperativo)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Margine: {incomeStatementData.margine.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden" shadow-sm>
             <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                 <h3 className="text-lg font-bold text-dark dark:text-white">Dettaglio Conto Economico - Anno {filterAnno}</h3>
                 <div className="text-xs text-gray-500 dark:text-gray-400">
                   Basato su fatture {filterStato.toLowerCase()}e
                 </div>
             </div>
             <div className="p-6">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-dark-border">
                        <th className="pb-4 whitespace-nowrap">Voce</th>
                        <th className="pb-4 whitespace-nowrap text-right">Importo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                     {/* Valore Produzione Section */}
                     <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                        <td colSpan={2} className="py-3 px-2 text-sm font-bold text-dark dark:text-white uppercase tracking-wide">A) Valore della Produzione (Entrate)</td>
                     </tr>
                     <tr className="hover:bg-gray-50 dark:hover:bg-dark-bg">
                        <td className="py-3 pl-6 text-sm text-gray-500 dark:text-gray-400">Ricavi da vendite e prestazioni</td>
                        <td className="py-3 pr-2 whitespace-nowrap text-right text-sm font-semibold text-green-700 dark:text-green-400">
                          {formatCurrency(incomeStatementData.entrate)}
                        </td>
                     </tr>
                     <tr className="bg-green-50/30 dark:bg-green-900/10 border-t border-green-100 dark:border-green-800">
                        <td className="py-3 pl-6 text-sm font-bold text-dark dark:text-white">Totale Valore Produzione</td>
                        <td className="py-3 pr-2 whitespace-nowrap text-right text-sm font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(incomeStatementData.entrate)}
                        </td>
                     </tr>

                     {/* Costi Produzione Section */}
                     <tr><td colSpan={2} className="py-4"></td></tr>
                     <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                        <td colSpan={2} className="py-3 px-2 text-sm font-bold text-dark dark:text-white uppercase tracking-wide">B) Costi della Produzione (Uscite)</td>
                     </tr>
                     <tr className="hover:bg-gray-50 dark:hover:bg-dark-bg">
                        <td className="py-3 pl-6 text-sm text-gray-500 dark:text-gray-400">Costi per servizi e beni</td>
                        <td className="py-3 pr-2 whitespace-nowrap text-right text-sm font-semibold text-red-600 dark:text-red-400">
                          ( {formatCurrency(incomeStatementData.uscite)} )
                        </td>
                     </tr>
                     <tr className="bg-red-50/30 dark:bg-red-900/10 border-t border-red-100 dark:border-red-800">
                        <td className="py-3 pl-6 text-sm font-bold text-dark dark:text-white">Totale Costi Produzione</td>
                        <td className="py-3 pr-2 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400">
                          ( {formatCurrency(incomeStatementData.uscite)} )
                        </td>
                     </tr>

                     {/* Difference */}
                      <tr><td colSpan={2} className="py-4"></td></tr>
                     <tr className="bg-primary/20 dark:bg-primary/10">
                        <td className="py-4 pl-2 text-base font-bold text-dark dark:text-white">Differenza tra Valore e Costi (A - B)</td>
                        <td className={`py-4 pr-2 whitespace-nowrap text-right text-base font-bold ${incomeStatementData.risultatoOperativo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(incomeStatementData.risultatoOperativo)}
                        </td>
                     </tr>
                  </tbody>
                </table>
             </div>
          </div>
        </>
      )}

      {/* Modal Aggiungi Voce */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 max-w-md w-full" shadow-sm>
            <h3 className="text-lg font-bold text-dark dark:text-white mb-4">Aggiungi Voce - {newItemForm.category}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={newItemForm.name || ''}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                  placeholder="Es. Liquidità, Debiti vs fornitori..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Importo (€)</label>
                <input
                  type="number"
                  value={newItemForm.amount || 0}
                  onChange={(e) => setNewItemForm({ ...newItemForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={async () => {
                  if (newItemForm.name && newItemForm.name.trim() && newItemForm.section && newItemForm.category) {
                    console.log('Saving item:', newItemForm);
                    const result = await addFinancialItem({
                      section: newItemForm.section,
                      category: newItemForm.category,
                      name: newItemForm.name,
                      amount: newItemForm.amount || 0
                    } as Omit<FinancialItem, 'id'>);

                    if (result) {
                      console.log('Item saved successfully:', result);
                      setIsAddingItem(false);
                      setNewItemForm({});
                    } else {
                      console.error('Failed to save item');
                      alert('Errore durante il salvataggio. Riprova.');
                    }
                  } else {
                    console.log('Validation failed:', newItemForm);
                    alert('Inserisci almeno il nome della voce');
                  }
                }}
                className="flex-1 bg-primary text-white pl-4 pr-12 py-2 rounded-lg font-medium hover:opacity-90 transition-all"
              >
                Salva
              </button>
              <button
                onClick={() => {
                  setIsAddingItem(false);
                  setNewItemForm({});
                }}
                className="flex-1 bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-gray-400 pl-4 pr-12 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Voce */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 max-w-md w-full" shadow-sm>
            <h3 className="text-lg font-bold text-dark dark:text-white mb-4">Modifica Voce</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Importo (€)</label>
                <input
                  type="number"
                  value={editingItem.amount}
                  onChange={(e) => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  updateFinancialItem(editingItem.id, {
                    name: editingItem.name,
                    amount: editingItem.amount
                  });
                  setEditingItem(null);
                }}
                className="flex-1 bg-primary text-white pl-4 pr-12 py-2 rounded-lg font-medium hover:opacity-90 transition-all"
              >
                Salva
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-gray-400 pl-4 pr-12 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};