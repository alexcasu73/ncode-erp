import React, { useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { useData } from '../context/DataContext';
import { ArrowUpRight, TrendingUp, Users, Wallet, TrendingDown, Download, FileText } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#D1F366', '#E5E7EB']; // Primary Green, Gray

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Helper per estrarre anno dalla data di pagamento (formato YYYY-MM-DD)
const getAnnoFromDate = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4));
  return isNaN(year) ? null : year;
};

// Ottiene l'importo effettivo del movimento (importo personalizzato o totale fattura)
const getImportoEffettivo = (cf: { importo?: number; invoice?: { flusso?: number; iva?: number } }): number => {
  if (cf.importo !== undefined && cf.importo !== null) {
    return cf.importo;
  }
  return (cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0);
};

export const Dashboard: React.FC = () => {
  const { customers, invoices, cashflowRecords, loading, getBankBalance } = useData();
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Calcola dati reali
  const dashboardData = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const lastYear = currentYear - 1;
    const startOfCurrentYear = new Date(currentYear, 0, 1); // 1 gennaio anno corrente
    const startYear = 2026; // Anno di inizio attività

    // Fatture effettive CUMULATIVE dall'inizio attività fino all'anno corrente
    const invoicesUpToCurrentYear = invoices.filter(inv =>
      inv.anno >= startYear && inv.anno <= currentYear && inv.statoFatturazione === 'Effettivo'
    );

    // Fatture effettive CUMULATIVE dall'inizio attività fino all'anno scorso
    const invoicesUpToLastYear = invoices.filter(inv =>
      inv.anno >= startYear && inv.anno <= lastYear && inv.statoFatturazione === 'Effettivo'
    );

    // Fatturato totale CUMULATIVO (entrate - uscite) - SOLO FLUSSO (senza IVA)
    const currentRevenue = invoicesUpToCurrentYear.reduce((sum, inv) => {
      const amount = inv.flusso || 0;
      return sum + (inv.tipo === 'Entrata' ? amount : -amount);
    }, 0);

    // Fatturato CUMULATIVO fino all'anno scorso - SOLO FLUSSO (senza IVA)
    const lastRevenue = invoicesUpToLastYear.reduce((sum, inv) => {
      const amount = inv.flusso || 0;
      return sum + (inv.tipo === 'Entrata' ? amount : -amount);
    }, 0);

    // Variazione percentuale fatturato
    const revenueChange = lastRevenue !== 0
      ? ((currentRevenue - lastRevenue) / Math.abs(lastRevenue)) * 100
      : currentRevenue !== 0 ? 100 : 0;

    // Numero di progetti unici - CUMULATIVO dall'inizio fino all'anno corrente
    const currentProjects = new Set(
      invoicesUpToCurrentYear.map(inv => inv.nomeProgetto || inv.spesa).filter(Boolean)
    ).size;

    // Progetti CUMULATIVI fino all'anno scorso
    const lastProjects = new Set(
      invoicesUpToLastYear.map(inv => inv.nomeProgetto || inv.spesa).filter(Boolean)
    ).size;

    // Variazione percentuale progetti (nuovi progetti aggiunti quest'anno)
    const projectsChange = lastProjects > 0
      ? ((currentProjects - lastProjects) / lastProjects) * 100
      : currentProjects > 0 ? 100 : 0;

    // Numero di fatture CUMULATIVO dall'inizio
    const currentTransactions = invoicesUpToCurrentYear.length;
    const lastTransactions = invoicesUpToLastYear.length;

    // Variazione percentuale fatture
    const transactionsChange = lastTransactions > 0
      ? ((currentTransactions - lastTransactions) / lastTransactions) * 100
      : currentTransactions > 0 ? 100 : 0;

    // SALDO CASSA (SALDO IN BANCA) - usa stessa logica del Flusso di Cassa
    // Mappa cashflow records con le fatture
    const cashflowWithInvoices = cashflowRecords.map(cf => {
      const invoice = invoices.find(inv => inv.id === cf.invoiceId);
      return { ...cf, invoice };
    });

    // Filtra per anno corrente e stato effettivo
    const currentYearCashflows = cashflowWithInvoices.filter(cf => {
      const anno = getAnnoFromDate(cf.dataPagamento);
      if (anno !== currentYear) return false;
      // Solo movimenti effettivi - usa lo stato del cashflow record se presente
      const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
      return stato === 'Effettivo';
    });

    // Filtra per anno scorso e stato effettivo
    const lastYearCashflows = cashflowWithInvoices.filter(cf => {
      const anno = getAnnoFromDate(cf.dataPagamento);
      if (anno !== lastYear) return false;
      // Solo movimenti effettivi - usa lo stato del cashflow record se presente
      const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
      return stato === 'Effettivo';
    });

    // Calcola entrate e uscite per anno corrente
    const currentCashflowIn = currentYearCashflows
      .filter(cf => {
        const tipo = cf.invoice?.tipo || cf.tipo;
        return tipo === 'Entrata';
      })
      .reduce((sum, cf) => sum + getImportoEffettivo(cf), 0);

    const currentCashflowOut = currentYearCashflows
      .filter(cf => {
        const tipo = cf.invoice?.tipo || cf.tipo;
        return tipo === 'Uscita';
      })
      .reduce((sum, cf) => sum + getImportoEffettivo(cf), 0);

    // Calcola entrate e uscite per anno scorso
    const lastCashflowIn = lastYearCashflows
      .filter(cf => {
        const tipo = cf.invoice?.tipo || cf.tipo;
        return tipo === 'Entrata';
      })
      .reduce((sum, cf) => sum + getImportoEffettivo(cf), 0);

    const lastCashflowOut = lastYearCashflows
      .filter(cf => {
        const tipo = cf.invoice?.tipo || cf.tipo;
        return tipo === 'Uscita';
      })
      .reduce((sum, cf) => sum + getImportoEffettivo(cf), 0);

    // Saldo netto movimenti
    const currentNetCashflow = currentCashflowIn - currentCashflowOut;
    const lastNetCashflow = lastCashflowIn - lastCashflowOut;

    // Saldo iniziale (saldo in banca ad inizio anno)
    const currentBankBalance = getBankBalance(currentYear);
    const saldoIniziale = currentBankBalance?.saldoIniziale || 0;

    // Saldo in banca = saldo iniziale + movimenti netti
    const currentCashBalance = saldoIniziale + currentNetCashflow;

    // Saldo anno scorso (per comparazione)
    const lastYearBankBalance = getBankBalance(lastYear);
    const lastSaldoIniziale = lastYearBankBalance?.saldoIniziale || 0;
    const lastCashBalance = lastSaldoIniziale + lastNetCashflow;

    const cashBalanceChange = lastCashBalance !== 0
      ? ((currentCashBalance - lastCashBalance) / Math.abs(lastCashBalance)) * 100
      : currentCashBalance !== 0 ? 100 : 0;

    // CLIENTI REALI (totali)
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;

    // Clienti con fatture CUMULATIVI
    const customersWithInvoices = new Set(
      invoicesUpToCurrentYear.map(inv => inv.customer).filter(Boolean)
    ).size;

    // Dati per grafico fatturato - 12 mesi dell'anno corrente (solo effettive e dal 1 gennaio)
    const revenueChartData = [];
    for (let i = 0; i < 12; i++) {
      const monthName = MESI[i];

      const monthInvoices = invoices.filter(inv =>
        inv.mese === monthName && inv.anno === currentYear && inv.statoFatturazione === 'Effettivo'
      );

      const revenue = monthInvoices.reduce((sum, inv) =>
        sum + (inv.flusso || 0) + (inv.iva || 0), 0
      );

      revenueChartData.push({
        name: monthName.substring(0, 3),
        value: revenue
      });
    }

    // Dati per grafico fatture - 12 mesi dell'anno corrente (solo effettive e dal 1 gennaio)
    const transactionsChartData = [];
    for (let i = 0; i < 12; i++) {
      const monthName = MESI[i];

      const monthInvoices = invoices.filter(inv =>
        inv.mese === monthName && inv.anno === currentYear && inv.statoFatturazione === 'Effettivo'
      );

      transactionsChartData.push({
        name: monthName.substring(0, 3),
        sales: monthInvoices.length
      });
    }

    return {
      currentRevenue,
      lastRevenue,
      revenueChange,
      currentProjects,
      lastProjects,
      projectsChange,
      currentTransactions,
      lastTransactions,
      transactionsChange,
      currentCashflowIn,
      currentCashflowOut,
      currentCashBalance,
      lastCashBalance,
      cashBalanceChange,
      saldoIniziale,
      totalCustomers,
      activeCustomers,
      customersWithInvoices,
      revenueChartData,
      transactionsChartData
    };
  }, [invoices, cashflowRecords, customers, getBankBalance]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  const handleExport = () => {
    const currentYear = new Date().getFullYear();

    // Sheet 1: KPI Principali
    const kpiData = [
      ['PANORAMICA AZIENDALE', ''],
      ['Data Export', new Date().toLocaleDateString('it-IT')],
      ['Anno', currentYear],
      [''],
      ['METRICHE PRINCIPALI', ''],
      ['Fatturato Totale', formatCurrency(dashboardData.currentRevenue)],
      ['Saldo in Banca', formatCurrency(dashboardData.currentCashBalance)],
      ['Progetti Attivi', dashboardData.currentProjects],
      ['Fatture Totali', dashboardData.currentTransactions],
      ['Clienti Totali', dashboardData.totalCustomers],
      ['Clienti Attivi', dashboardData.activeCustomers],
      ['Clienti con Fatture', dashboardData.customersWithInvoices],
      [],
      ['DETTAGLI FLUSSO DI CASSA'],
      ['Saldo Iniziale', formatCurrency(dashboardData.saldoIniziale)],
      ['Entrate', formatCurrency(dashboardData.currentCashflowIn)],
      ['Uscite', formatCurrency(dashboardData.currentCashflowOut)],
      ['Saldo Netto Movimenti', formatCurrency(dashboardData.currentCashflowIn - dashboardData.currentCashflowOut)],
      ['Saldo in Banca', formatCurrency(dashboardData.currentCashBalance)]
    ];

    // Crea il workbook
    const wb = XLSX.utils.book_new();

    // Aggiungi foglio KPI
    const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, 'Metriche KPI');

    // Aggiungi foglio fatturato mensile
    const wsRevenue = XLSX.utils.json_to_sheet(dashboardData.revenueChartData.map(item => ({
      Mese: item.name,
      Fatturato: item.value
    })));
    XLSX.utils.book_append_sheet(wb, wsRevenue, 'Fatturato Mensile');

    // Aggiungi foglio fatture mensili
    const wsTransactions = XLSX.utils.json_to_sheet(dashboardData.transactionsChartData.map(item => ({
      Mese: item.name,
      'Numero Fatture': item.sales
    })));
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Fatture Mensili');

    // Genera e scarica il file
    XLSX.writeFile(wb, `Panoramica_${currentYear}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;

    const currentYear = new Date().getFullYear();
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    // Header con colore primario
    pdf.setFillColor(255, 138, 0); // Arancione primary
    pdf.rect(0, 0, pageWidth, 35, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.text('Panoramica Aziendale', margin, 18);

    pdf.setFontSize(11);
    pdf.text(`Anno ${currentYear}`, margin, 26);
    pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, pageWidth - margin - 50, 26);

    pdf.setTextColor(0, 0, 0);
    let yPos = 45;

    // Sezione KPI Cards
    pdf.setFontSize(16);
    pdf.setTextColor(255, 138, 0);
    pdf.text('Indicatori Chiave', margin, yPos);
    yPos += 10;

    pdf.setTextColor(0, 0, 0);

    // Cattura i KPI cards
    const kpiGrid = dashboardRef.current.querySelector('.grid') as HTMLElement;
    if (kpiGrid) {
      const canvas = await html2canvas(kpiGrid, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (yPos + imgHeight > pageHeight - margin) {
        pdf.addPage();

        // Header su nuova pagina
        pdf.setFillColor(255, 138, 0);
        pdf.rect(0, 0, pageWidth, 20, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.text('Panoramica Aziendale', margin, 12);
        pdf.setTextColor(0, 0, 0);

        yPos = 30;
      }

      pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 15;
    }

    // Sezione Andamento Mensile
    pdf.setFontSize(16);
    pdf.setTextColor(255, 138, 0);

    if (yPos > pageHeight - 100) {
      pdf.addPage();
      pdf.setFillColor(255, 138, 0);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text('Panoramica Aziendale', margin, 12);
      pdf.setTextColor(0, 0, 0);
      yPos = 30;
      pdf.setTextColor(255, 138, 0);
      pdf.setFontSize(16);
    }

    pdf.text('Andamento Mensile', margin, yPos);
    yPos += 10;

    pdf.setTextColor(0, 0, 0);

    // Trova tutti i chart containers con p-8 (grafici grandi)
    const chartSections = dashboardRef.current.querySelectorAll('.bg-white.dark\\:bg-dark-card.p-8.rounded-xl, .bg-white.dark\\:bg-dark-card.p-6.rounded-xl');

    // Cerca e cattura la sezione "Andamento Mensile Fatturato"
    for (let section of Array.from(chartSections)) {
      const heading = section.querySelector('h3');
      if (heading?.textContent?.includes('Andamento Mensile Fatturato')) {
        const canvas = await html2canvas(section as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(255, 138, 0);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('Panoramica Aziendale', margin, 12);
          pdf.setTextColor(0, 0, 0);
          yPos = 30;
        }

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
        break;
      }
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
    pdf.save(`Panoramica_${currentYear}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div ref={dashboardRef} className="flex flex-col gap-6 h-full animate-fade-in pb-8">
      {/* Header Section for Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-page-title text-dark dark:text-white">Panoramica</h1>
          <p className="text-page-subtitle text-gray-500 dark:text-gray-400 mt-1">Informazioni dettagliate sulla tua attività</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-dark-card rounded-lg px-4 py-2 flex items-center gap-2 border border-gray-200 dark:border-dark-border shadow-sm">
                <span className="text-sm font-medium text-dark dark:text-white">Anno {new Date().getFullYear()}</span>
            </div>
            <button
              onClick={handleExportPDF}
              className="bg-white dark:bg-dark-card text-dark dark:text-white border border-gray-200 dark:border-dark-border px-6 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 shadow-sm"
            >
                <FileText size={18} />
                PDF
            </button>
            <button
              onClick={handleExport}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
            >
                <Download size={18} />
                Excel
            </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 flex-shrink-0">
        {/* Revenue Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-gray-500 dark:text-gray-400" />
              <h3 className="text-card-title text-gray-500 dark:text-gray-400">Margine (Effettivo)</h3>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-kpi-value ${dashboardData.currentRevenue >= 0 ? 'text-secondary' : 'text-red-600'}`}>
                {formatCurrency(dashboardData.currentRevenue)}
              </span>
              {dashboardData.lastRevenue !== 0 && (
                <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.revenueChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                  {dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange.toFixed(1)}%
                </span>
              )}
            </div>
            {dashboardData.lastRevenue !== 0 && (
              <p className="text-small text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrency(dashboardData.lastRevenue)} anno scorso
              </p>
            )}
          </div>
          <div className="h-16 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.revenueChartData}>
                 <Bar dataKey="value" fill="#0EA5E9" radius={[4, 4, 4, 4]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Balance Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} className="text-primary" />
              <h3 className="text-card-title text-gray-500 dark:text-gray-400">Saldo in Banca (Effettivo)</h3>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-kpi-value ${dashboardData.currentCashBalance >= 0 ? 'text-secondary' : 'text-red-600'}`}>
                {formatCurrency(dashboardData.currentCashBalance)}
              </span>
              {dashboardData.lastCashBalance !== 0 && (
                <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.cashBalanceChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                  {dashboardData.cashBalanceChange >= 0 ? '+' : ''}{dashboardData.cashBalanceChange.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="space-y-1 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Iniziale: {formatCurrency(dashboardData.saldoIniziale || 0)}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <TrendingUp size={14} className="text-secondary" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(dashboardData.currentCashflowIn)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(dashboardData.currentCashflowOut)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customers Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} className="text-primary" />
              <h3 className="text-card-title text-gray-500 dark:text-gray-400">Clienti</h3>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-kpi-value text-dark dark:text-white">{dashboardData.totalCustomers}</span>
            </div>
            <p className="text-small text-gray-500 dark:text-gray-400 mt-1">{dashboardData.activeCustomers} attivi</p>
            <p className="text-small text-gray-500 dark:text-gray-400">{dashboardData.customersWithInvoices} con fatture quest'anno</p>
          </div>
        </div>

        {/* Projects Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
          <div>
             <h3 className="text-card-title text-gray-500 dark:text-gray-400">Progetti Attivi</h3>
             <div className="flex items-center gap-3 mt-2">
                 <span className="text-kpi-value text-dark dark:text-white">{dashboardData.currentProjects}</span>
                 {dashboardData.lastProjects > 0 && (
                   <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.projectsChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                     {dashboardData.projectsChange >= 0 ? '+' : ''}{dashboardData.projectsChange.toFixed(1)}%
                   </span>
                 )}
             </div>
             {dashboardData.lastProjects > 0 && (
               <p className="text-small text-gray-500 dark:text-gray-400 mt-1">{dashboardData.lastProjects} progetti anno scorso</p>
             )}
          </div>
        </div>

        {/* Invoices Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
            <div>
                <h3 className="text-card-title text-gray-500 dark:text-gray-400">Fatture Totali</h3>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-kpi-value text-dark dark:text-white">{dashboardData.currentTransactions}</span>
                    {dashboardData.lastTransactions > 0 && (
                      <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.transactionsChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                        {dashboardData.transactionsChange >= 0 ? '+' : ''}{dashboardData.transactionsChange.toFixed(1)}%
                      </span>
                    )}
                </div>
                {dashboardData.lastTransactions > 0 && (
                  <p className="text-small text-gray-500 dark:text-gray-400 mt-1">{dashboardData.lastTransactions} fatture anno scorso</p>
                )}
            </div>
            <div className="h-16 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.transactionsChartData}>
                        <Line type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Andamento Mensile Fatturato */}
      <div className="bg-white dark:bg-dark-card p-8 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-center mb-8 flex-shrink-0">
          <h3 className="text-section-title text-dark dark:text-white">Andamento Mensile Fatturato</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Anno {new Date().getFullYear()}
          </div>
        </div>
        <div className="w-full flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboardData.revenueChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                dy={10}
              />
              <Tooltip
                cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }}
                contentStyle={{
                  backgroundColor: '#1E293B',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  padding: '12px'
                }}
                itemStyle={{ color: '#fff' }}
                formatter={(value) => formatCurrency(Number(value))}
                labelStyle={{ color: '#0EA5E9', fontWeight: 'bold' }}
              />
              <Bar dataKey="value" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
