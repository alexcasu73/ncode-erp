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

    // Fatture effettive dell'anno corrente
    const currentYearInvoices = invoices.filter(inv =>
      inv.anno === currentYear && inv.statoFatturazione === 'Effettivo'
    );

    // Fatture effettive dell'anno scorso
    const lastYearInvoices = invoices.filter(inv =>
      inv.anno === lastYear && inv.statoFatturazione === 'Effettivo'
    );

    // Fatturato totale anno corrente
    const currentRevenue = currentYearInvoices.reduce((sum, inv) =>
      sum + (inv.flusso || 0) + (inv.iva || 0), 0
    );

    // Fatturato anno scorso
    const lastRevenue = lastYearInvoices.reduce((sum, inv) =>
      sum + (inv.flusso || 0) + (inv.iva || 0), 0
    );

    // Variazione percentuale fatturato
    const revenueChange = lastRevenue > 0
      ? ((currentRevenue - lastRevenue) / lastRevenue) * 100
      : 0;

    // Numero di progetti unici - anno corrente
    const currentProjects = new Set(
      currentYearInvoices.map(inv => inv.nomeProgetto || inv.spesa).filter(Boolean)
    ).size;

    // Progetti anno scorso
    const lastProjects = new Set(
      lastYearInvoices.map(inv => inv.nomeProgetto || inv.spesa).filter(Boolean)
    ).size;

    // Variazione percentuale progetti
    const projectsChange = lastProjects > 0
      ? ((currentProjects - lastProjects) / lastProjects) * 100
      : 0;

    // Numero di fatture anno corrente
    const currentTransactions = currentYearInvoices.length;
    const lastTransactions = lastYearInvoices.length;

    // Variazione percentuale fatture
    const transactionsChange = lastTransactions > 0
      ? ((currentTransactions - lastTransactions) / lastTransactions) * 100
      : 0;

    // CASHFLOW REALE - Movimenti di cassa anno corrente
    const currentYearCashflows = cashflowRecords.filter(cf => {
      if (!cf.dataPagamento) return false;
      const cfDate = new Date(cf.dataPagamento);
      return cfDate.getFullYear() === currentYear;
    });

    // Cashflow anno scorso
    const lastYearCashflows = cashflowRecords.filter(cf => {
      if (!cf.dataPagamento) return false;
      const cfDate = new Date(cf.dataPagamento);
      return cfDate.getFullYear() === lastYear;
    });

    // Calcola entrate e uscite reali
    const currentCashflowIn = currentYearCashflows
      .filter(cf => cf.tipo === 'Entrata')
      .reduce((sum, cf) => sum + (cf.importo || 0), 0);

    const currentCashflowOut = currentYearCashflows
      .filter(cf => cf.tipo === 'Uscita')
      .reduce((sum, cf) => sum + (cf.importo || 0), 0);

    const currentCashBalance = currentCashflowIn - currentCashflowOut;

    const lastCashflowIn = lastYearCashflows
      .filter(cf => cf.tipo === 'Entrata')
      .reduce((sum, cf) => sum + (cf.importo || 0), 0);

    const lastCashflowOut = lastYearCashflows
      .filter(cf => cf.tipo === 'Uscita')
      .reduce((sum, cf) => sum + (cf.importo || 0), 0);

    const lastCashBalance = lastCashflowIn - lastCashflowOut;

    const cashBalanceChange = lastCashBalance !== 0
      ? ((currentCashBalance - lastCashBalance) / Math.abs(lastCashBalance)) * 100
      : 0;

    // CLIENTI REALI
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;

    // Clienti con fatture nell'anno corrente
    const customersWithInvoices = new Set(
      currentYearInvoices.map(inv => inv.customer).filter(Boolean)
    ).size;

    // Dati per grafico fatturato - 12 mesi dell'anno corrente (solo effettive)
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

    // Dati per grafico fatture - 12 mesi dell'anno corrente (solo effettive)
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
              <span className="text-kpi-value text-dark dark:text-white">
                {formatCurrencyNoDecimals(dashboardData.currentRevenue)}
              </span>
              <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.revenueChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                {dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange.toFixed(1)}%
              </span>
            </div>
            <p className="text-small text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrencyNoDecimals(dashboardData.lastRevenue)} anno scorso
            </p>
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
              <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.cashBalanceChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                {dashboardData.cashBalanceChange >= 0 ? '+' : ''}{dashboardData.cashBalanceChange.toFixed(1)}%
              </span>
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
                 <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.projectsChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                   {dashboardData.projectsChange >= 0 ? '+' : ''}{dashboardData.projectsChange.toFixed(1)}%
                 </span>
             </div>
             <p className="text-small text-gray-500 dark:text-gray-400 mt-1">{dashboardData.lastProjects} progetti anno scorso</p>
          </div>
        </div>

        {/* Invoices Card */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl flex flex-col justify-between min-h-[180px] shadow-sm border border-gray-100 dark:border-dark-border">
            <div>
                <h3 className="text-card-title text-gray-500 dark:text-gray-400">Fatture Totali</h3>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-kpi-value text-dark dark:text-white">{dashboardData.currentTransactions}</span>
                    <span className={`text-white text-xs px-2 py-1 rounded-md font-medium ${dashboardData.transactionsChange >= 0 ? 'bg-secondary' : 'bg-red-600'}`}>
                      {dashboardData.transactionsChange >= 0 ? '+' : ''}{dashboardData.transactionsChange.toFixed(1)}%
                    </span>
                </div>
                <p className="text-small text-gray-500 dark:text-gray-400 mt-1">{dashboardData.lastTransactions} fatture anno scorso</p>
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
