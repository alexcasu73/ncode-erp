import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Download, Printer, Filter, Building2, TrendingUp, TrendingDown, Scale } from 'lucide-react';

export const FinancialStatement: React.FC = () => {
  const { financialItems, loading } = useData();
  const [activeTab, setActiveTab] = useState<'balance' | 'income'>('balance');

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  // Helper calculations
  const assets = financialItems.filter(i => i.section === 'Stato Patrimoniale' && i.category === 'Attivo');
  const liabilities = financialItems.filter(i => i.section === 'Stato Patrimoniale' && i.category === 'Passivo');

  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
  // Net Assets (Patrimonio Netto is typically included in Passivo in Italian standard layouts as source of funds, but let's calculate gap)
  const equityGap = totalAssets - totalLiabilities; // Should ideally match if balanced properly

  const productionValue = financialItems.filter(i => i.category === 'Valore della Produzione');
  const productionCosts = financialItems.filter(i => i.category === 'Costi della Produzione');

  const totalProdValue = productionValue.reduce((sum, item) => sum + item.amount, 0);
  const totalProdCosts = productionCosts.reduce((sum, item) => sum + item.amount, 0);
  const operatingResult = totalProdValue - totalProdCosts;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Bilancio</h1>
          <p className="text-gray-500 mt-1">Stato Patrimoniale e Conto Economico</p>
        </div>
        <div className="flex gap-2">
           <button className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
                <Printer size={18} />
                Stampa
            </button>
            <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
                <Download size={18} className="text-primary"/>
                Esporta PDF
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white rounded-2xl w-fit shadow-sm border border-gray-100">
        <button 
          onClick={() => setActiveTab('balance')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'balance' ? 'bg-dark text-white shadow-md' : 'text-gray-500 hover:text-dark'
          }`}
        >
          Stato Patrimoniale
        </button>
        <button 
          onClick={() => setActiveTab('income')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'income' ? 'bg-dark text-white shadow-md' : 'text-gray-500 hover:text-dark'
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
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-t-4 border-green-500">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Building2 size={18} />
                    <h3 className="text-sm font-medium">Totale Attivo</h3>
                </div>
                <p className="text-3xl font-bold text-dark">€ {totalAssets.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-t-4 border-red-400">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Scale size={18} />
                    <h3 className="text-sm font-medium">Totale Passivo</h3>
                </div>
                <p className="text-3xl font-bold text-dark">€ {totalLiabilities.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-t-4 border-primary">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <TrendingUp size={18} />
                    <h3 className="text-sm font-medium">Utile d'Esercizio (Calc)</h3>
                </div>
                <p className="text-3xl font-bold text-dark">€ {equityGap.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attivo */}
            <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden h-full">
              <div className="p-6 border-b border-gray-100 bg-green-50/50">
                <h3 className="text-lg font-bold text-dark">Attivo</h3>
              </div>
              <div className="p-6">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-50">
                    {assets.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-sm font-medium text-gray-600">{item.name}</td>
                        <td className="py-3 text-right text-sm font-bold text-dark">€ {item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="py-4 pl-2 text-base font-bold text-dark">Totale Attivo</td>
                      <td className="py-4 pr-2 text-right text-base font-bold text-green-600">€ {totalAssets.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Passivo */}
            <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden h-full">
              <div className="p-6 border-b border-gray-100 bg-red-50/50">
                <h3 className="text-lg font-bold text-dark">Passivo e Netto</h3>
              </div>
              <div className="p-6">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-50">
                    {liabilities.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-sm font-medium text-gray-600">{item.name}</td>
                        <td className="py-3 text-right text-sm font-bold text-dark">€ {item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                     <tr className="bg-primary/20">
                      <td className="py-3 pl-2 text-sm font-bold text-dark">Utile d'Esercizio (Corrente)</td>
                      <td className="py-3 pr-2 text-right text-sm font-bold text-dark">€ {equityGap.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="py-4 pl-2 text-base font-bold text-dark">Totale a Pareggio</td>
                      <td className="py-4 pr-2 text-right text-base font-bold text-red-500">€ {(totalLiabilities + equityGap).toLocaleString()}</td>
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
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-green-500">
                <h3 className="text-gray-500 text-sm font-medium">Valore della Produzione</h3>
                <p className="text-3xl font-bold text-dark mt-2">€ {totalProdValue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-red-400">
                <h3 className="text-gray-500 text-sm font-medium">Costi della Produzione</h3>
                <p className="text-3xl font-bold text-dark mt-2">€ {totalProdCosts.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-primary">
                <h3 className="text-gray-500 text-sm font-medium">Risultato Operativo (EBIT)</h3>
                <p className="text-3xl font-bold text-dark mt-2">€ {operatingResult.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Margine: {((operatingResult / totalProdValue) * 100).toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-dark">Dettaglio Conto Economico</h3>
                 <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                    <Filter size={20} />
                </button>
             </div>
             <div className="p-6">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-4">Voce</th>
                        <th className="pb-4 text-right">Importo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {/* Valore Produzione Section */}
                     <tr className="bg-gray-50/50">
                        <td colSpan={2} className="py-3 px-2 text-sm font-bold text-dark uppercase tracking-wide">A) Valore della Produzione</td>
                     </tr>
                     {productionValue.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-3 pl-6 text-sm text-gray-600">{item.name}</td>
                            <td className="py-3 pr-2 text-right text-sm font-semibold text-green-700">€ {item.amount.toLocaleString()}</td>
                        </tr>
                     ))}
                     <tr className="bg-green-50/30 border-t border-green-100">
                        <td className="py-3 pl-6 text-sm font-bold text-dark">Totale Valore Produzione</td>
                        <td className="py-3 pr-2 text-right text-sm font-bold text-green-700">€ {totalProdValue.toLocaleString()}</td>
                     </tr>

                     {/* Costi Produzione Section */}
                     <tr><td colSpan={2} className="py-4"></td></tr>
                     <tr className="bg-gray-50/50">
                        <td colSpan={2} className="py-3 px-2 text-sm font-bold text-dark uppercase tracking-wide">B) Costi della Produzione</td>
                     </tr>
                     {productionCosts.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-3 pl-6 text-sm text-gray-600">{item.name}</td>
                            <td className="py-3 pr-2 text-right text-sm font-semibold text-red-600">( € {item.amount.toLocaleString()} )</td>
                        </tr>
                     ))}
                     <tr className="bg-red-50/30 border-t border-red-100">
                        <td className="py-3 pl-6 text-sm font-bold text-dark">Totale Costi Produzione</td>
                        <td className="py-3 pr-2 text-right text-sm font-bold text-red-600">( € {totalProdCosts.toLocaleString()} )</td>
                     </tr>

                     {/* Difference */}
                      <tr><td colSpan={2} className="py-4"></td></tr>
                     <tr className="bg-primary/20">
                        <td className="py-4 pl-2 text-base font-bold text-dark">Differenza tra Valore e Costi (A - B)</td>
                        <td className="py-4 pr-2 text-right text-base font-bold text-dark">€ {operatingResult.toLocaleString()}</td>
                     </tr>
                  </tbody>
                </table>
             </div>
          </div>
        </>
      )}
    </div>
  );
};