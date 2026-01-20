import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useUserRole } from '../hooks/useUserRole';
import { Download, Printer, Filter, Building2, TrendingUp, TrendingDown, Scale, Edit2, Plus, X, Check } from 'lucide-react';
import { FinancialItem } from '../types';
import { formatCurrency, formatCurrencyNoDecimals } from '../lib/currency';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const { canEdit, canDelete, isViewer, loading: roleLoading } = useUserRole();

  const [activeTab, setActiveTab] = useState<'balance' | 'income'>('balance');
  const [filterStato, setFilterStato] = useState<'Stimato' | 'Effettivo'>('Effettivo');
  const [filterAnno, setFilterAnno] = useState<number>(new Date().getFullYear());
  const [editingItem, setEditingItem] = useState<FinancialItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState<Partial<FinancialItem>>({});
  const [isExporting, setIsExporting] = useState(false);
  const bilancioRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  // Calcola gli anni disponibili dalle fatture
  const availableYears = useMemo(() => {
    const years = new Set(invoices.map(inv => inv.anno));
    if (years.size === 0) {
      return [new Date().getFullYear()];
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  // Calcola dati reali dal Conto Economico basato su fatture
  const incomeStatementData = useMemo(() => {
    // Filtra fatture per anno e stato
    const filteredInvoices = invoices.filter(inv => {
      return inv.anno === filterAnno && inv.statoFatturazione === filterStato;
    });

    // Calcola Entrate (Valore della Produzione) - SOLO IMPONIBILE (senza IVA)
    const entrate = filteredInvoices
      .filter(inv => inv.tipo === 'Entrata')
      .reduce((sum, inv) => sum + (inv.flusso || 0), 0);

    // Calcola Uscite (Costi della Produzione) - SOLO IMPONIBILE (senza IVA)
    const uscite = filteredInvoices
      .filter(inv => inv.tipo === 'Uscita')
      .reduce((sum, inv) => sum + (inv.flusso || 0), 0);

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

  const handleExportPDF = async () => {
    if (!bilancioRef.current) return;

    try {
      setIsExporting(true);
      // Aspetta che l'overlay si renderizzi
      await new Promise(resolve => setTimeout(resolve, 200));

      const originalTab = activeTab;

      // Cattura Stato Patrimoniale
      const balanceScreenshots: any = {};
      setActiveTab('balance');
      await new Promise(resolve => setTimeout(resolve, 300));

      const balanceKpiGrid = bilancioRef.current.querySelector('.grid.grid-cols-1.md\\:grid-cols-3') as HTMLElement;
      if (balanceKpiGrid) {
        balanceScreenshots.kpi = await html2canvas(balanceKpiGrid, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
      }

      const balanceDetailGrid = bilancioRef.current.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2') as HTMLElement;
      if (balanceDetailGrid) {
        balanceScreenshots.detail = await html2canvas(balanceDetailGrid, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
      }

      // Cattura Conto Economico
      const incomeScreenshots: any = {};
      setActiveTab('income');
      await new Promise(resolve => setTimeout(resolve, 300));

      const incomeKpiGrid = bilancioRef.current.querySelector('.grid.grid-cols-1.md\\:grid-cols-3') as HTMLElement;
      if (incomeKpiGrid) {
        incomeScreenshots.kpi = await html2canvas(incomeKpiGrid, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
      }

      const incomeDetailTable = bilancioRef.current.querySelector('.bg-white.dark\\:bg-dark-card.rounded-xl.overflow-hidden') as HTMLElement;
      if (incomeDetailTable) {
        incomeScreenshots.detail = await html2canvas(incomeDetailTable, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
      }

      // Ripristina tab originale
      setActiveTab(originalTab);

      // Crea PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header con colore primario
      pdf.setFillColor(255, 138, 0);
      pdf.rect(0, 0, pageWidth, 35, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Bilancio', margin, 18);

      pdf.setFontSize(11);
      pdf.text(`Anno ${filterAnno}`, margin, 26);
      pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, pageWidth - margin - 50, 26);

      pdf.setTextColor(0, 0, 0);
      let yPos = 45;

      // Sezione 1: Stato Patrimoniale
      pdf.setFontSize(16);
      pdf.setTextColor(255, 138, 0);
      pdf.text('Stato Patrimoniale', margin, yPos);
      yPos += 10;
      pdf.setTextColor(0, 0, 0);

      // KPI Stato Patrimoniale
      if (balanceScreenshots.kpi) {
        const imgData = balanceScreenshots.kpi.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (balanceScreenshots.kpi.height * imgWidth) / balanceScreenshots.kpi.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
        }

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 15;
      }

      // Dettaglio Stato Patrimoniale
      if (balanceScreenshots.detail) {
        pdf.setFontSize(16);
        pdf.setTextColor(255, 138, 0);

        if (yPos > pageHeight - 100) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
          pdf.setTextColor(255, 138, 0);
          pdf.setFontSize(16);
        }

        pdf.text('Dettaglio', margin, yPos);
        yPos += 10;
        pdf.setTextColor(0, 0, 0);

        const imgData = balanceScreenshots.detail.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (balanceScreenshots.detail.height * imgWidth) / balanceScreenshots.detail.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
        }

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      }

      // Nuova pagina per Conto Economico
      pdf.addPage();
      pdf.setFillColor(255, 138, 0);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text('Bilancio', margin, 12);
      pdf.setTextColor(0, 0, 0);
      yPos = 30;

      // Sezione 2: Conto Economico
      pdf.setFontSize(16);
      pdf.setTextColor(255, 138, 0);
      pdf.text('Conto Economico', margin, yPos);
      yPos += 10;
      pdf.setTextColor(0, 0, 0);

      // KPI Conto Economico
      if (incomeScreenshots.kpi) {
        const imgData = incomeScreenshots.kpi.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (incomeScreenshots.kpi.height * imgWidth) / incomeScreenshots.kpi.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
        }

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 15;
      }

      // Dettaglio Conto Economico
      if (incomeScreenshots.detail) {
        pdf.setFontSize(16);
        pdf.setTextColor(255, 138, 0);

        if (yPos > pageHeight - 100) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
          pdf.setTextColor(255, 138, 0);
          pdf.setFontSize(16);
        }

        pdf.text('Dettaglio', margin, yPos);
        yPos += 10;
        pdf.setTextColor(0, 0, 0);

        const imgData = incomeScreenshots.detail.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (incomeScreenshots.detail.height * imgWidth) / incomeScreenshots.detail.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Bilancio', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
        }

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      }

      // Footer su ogni pagina
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Pagina ${i} di ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        pdf.text('Generato da nCode ERP', pageWidth - margin - 35, pageHeight - 10);
      }

      // Salva il PDF
      const fileName = `Bilancio_Completo_${filterAnno}_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF:', fileName);

      // Usa blob per forzare il download
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('PDF saved successfully');

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Errore durante la generazione del PDF. Riprova.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={bilancioRef} className="flex flex-col gap-6 h-full animate-fade-in" style={{ paddingBottom: '20px' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
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
              className="border-none outline-none bg-transparent text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer pl-3 pr-8"
            >
              {availableYears.map(anno => (
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
                className="border-none outline-none bg-transparent text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer pl-3 pr-8"
              >
                <option value="Effettivo">Effettivo</option>
                <option value="Stimato">Stimato</option>
              </select>
            </div>
          )}

           <button
              onClick={() => window.print()}
              className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 pl-4 pr-12 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors flex items-center gap-2" shadow-sm
            >
                <Printer size={18} />
                Stampa
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
            >
                <Download size={18} />
                Esporta PDF
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white dark:bg-dark-card rounded-lg w-fit border border-gray-200 dark:border-dark-border flex-shrink-0" shadow-sm>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Attivo */}
            <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden flex flex-col" shadow-sm>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border bg-green-50/50 dark:bg-green-900/10 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-dark dark:text-white">Attivo</h3>
                {!roleLoading && canEdit && (
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
                )}
              </div>
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
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
                            {!roleLoading && canEdit && (
                              <button
                                onClick={() => setEditingItem(item)}
                                className="p-1 hover:bg-gray-50 dark:hover:bg-dark-bg rounded text-gray-500 dark:text-gray-400"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {!roleLoading && canDelete && (
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
                            )}
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
            <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden flex flex-col" shadow-sm>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border bg-red-50/50 dark:bg-red-900/10 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-dark dark:text-white">Passivo e Netto</h3>
                {!roleLoading && canEdit && (
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
                )}
              </div>
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
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
                            {!roleLoading && canEdit && (
                              <button
                                onClick={() => setEditingItem(item)}
                                className="p-1 hover:bg-gray-50 dark:hover:bg-dark-bg rounded text-gray-500 dark:text-gray-400"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {!roleLoading && canDelete && (
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
                            )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
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

          <div className="bg-white dark:bg-dark-card rounded-xl overflow-hidden flex-1 flex flex-col min-h-0" shadow-sm>
             <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center flex-shrink-0">
                 <h3 className="text-lg font-bold text-dark dark:text-white">Dettaglio Conto Economico - Anno {filterAnno}</h3>
                 <div className="text-xs text-gray-500 dark:text-gray-400">
                   Basato su fatture {filterStato.toLowerCase()}e
                 </div>
             </div>
             <div className="p-6 flex-1 overflow-y-auto min-h-0">
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

      {/* Overlay esportazione PDF */}
      {isExporting && (
        <div className="fixed inset-0 bg-white dark:bg-dark flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-dark-card rounded-lg p-8 flex flex-col items-center gap-4 shadow-xl border border-gray-200 dark:border-dark-border">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
            <p className="text-dark dark:text-white font-medium text-lg">Generazione PDF in corso...</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Attendere prego</p>
          </div>
        </div>
      )}
    </div>
  );
};