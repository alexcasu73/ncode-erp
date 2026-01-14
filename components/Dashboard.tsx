import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { useData } from '../context/DataContext';
import { ArrowUpRight, TrendingUp, Users, Wallet, TrendingDown } from 'lucide-react';
import { formatCurrency, formatCurrencyNoDecimals } from '../lib/currency';

const COLORS = ['#D1F366', '#E5E7EB']; // Primary Green, Gray

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const Dashboard: React.FC = () => {
  const { customers, invoices, cashflowRecords, loading } = useData();

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

    // SALDO CASSA CUMULATIVO basato sulle fatture effettive (con IVA)
    const currentCashflowIn = invoicesUpToCurrentYear
      .filter(inv => inv.tipo === 'Entrata')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    const currentCashflowOut = invoicesUpToCurrentYear
      .filter(inv => inv.tipo === 'Uscita')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    const currentCashBalance = currentCashflowIn - currentCashflowOut;

    const lastCashflowIn = invoicesUpToLastYear
      .filter(inv => inv.tipo === 'Entrata')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    const lastCashflowOut = invoicesUpToLastYear
      .filter(inv => inv.tipo === 'Uscita')
      .reduce((sum, inv) => sum + (inv.flusso || 0) + (inv.iva || 0), 0);

    const lastCashBalance = lastCashflowIn - lastCashflowOut;

    const cashBalanceChange = lastCashBalance !== 0
      ? ((currentCashBalance - lastCashBalance) / Math.abs(lastCashBalance)) * 100
      : currentCashBalance !== 0 ? 100 : 0;

    // CLIENTI REALI (già cumulativi)
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
      totalCustomers,
      activeCustomers,
      customersWithInvoices,
      revenueChartData,
      transactionsChartData
    };
  }, [invoices, cashflowRecords, customers]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header Section for Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-dark dark:text-white">Panoramica</h1>
          <p className="text-page-subtitle text-gray-500 dark:text-gray-400 mt-1">Informazioni dettagliate sulla tua attività</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-dark-card rounded-lg px-4 py-2 flex items-center gap-2 border border-gray-200 dark:border-dark-border shadow-sm">
                <span className="text-sm font-medium text-dark dark:text-white">Anno {new Date().getFullYear()}</span>
            </div>
            <button className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm">
                <ArrowUpRight size={18} />
                Esporta
            </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Revenue Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
          <div>
            <h3 className="text-card-title text-gray-500 dark:text-gray-400">Fatturato Totale</h3>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-kpi-value ${dashboardData.currentRevenue >= 0 ? 'text-secondary' : 'text-red-600'}`}>
                {formatCurrencyNoDecimals(dashboardData.currentRevenue)}
              </span>
              {dashboardData.lastRevenue !== 0 && (
                <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.revenueChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                  {dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange.toFixed(1)}%
                </span>
              )}
            </div>
            {dashboardData.lastRevenue !== 0 && (
              <p className="text-small text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrencyNoDecimals(dashboardData.lastRevenue)} anno scorso
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
              <h3 className="text-card-title text-gray-500 dark:text-gray-400">Saldo Cassa</h3>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-kpi-value ${dashboardData.currentCashBalance >= 0 ? 'text-secondary' : 'text-red-600'}`}>
                {formatCurrencyNoDecimals(dashboardData.currentCashBalance)}
              </span>
              {dashboardData.lastCashBalance !== 0 && (
                <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.cashBalanceChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                  {dashboardData.cashBalanceChange >= 0 ? '+' : ''}{dashboardData.cashBalanceChange.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-secondary" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatCurrencyNoDecimals(dashboardData.currentCashflowIn)}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown size={14} className="text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatCurrencyNoDecimals(dashboardData.currentCashflowOut)}</span>
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
      <div className="bg-white dark:bg-dark-card p-8 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-section-title text-dark dark:text-white">Andamento Mensile Fatturato</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Anno {new Date().getFullYear()}
          </div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboardData.revenueChartData}>
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
              <Bar dataKey="value" fill="#0EA5E9" radius={[8, 8, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
