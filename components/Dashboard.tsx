import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { SALES_DATA, REVENUE_DATA } from '../constants';
import { useData } from '../context/DataContext';
import { ArrowUpRight, TrendingUp, MoreVertical, Search, Bell } from 'lucide-react';
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
      revenueChartData,
      transactionsChartData
    };
  }, [invoices]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header Section for Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-dark">Panoramica</h1>
          <p className="text-page-subtitle mt-1">Informazioni dettagliate sulla tua attività</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-gray-100">
                <span className="text-sm font-medium text-gray-700">Anno {new Date().getFullYear()}</span>
            </div>
            <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
                <ArrowUpRight size={18} className="text-primary"/>
                Esporta
            </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[180px]">
          <div>
            <h3 className="text-card-title">Fatturato Totale</h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-kpi-value text-dark">
                {formatCurrencyNoDecimals(dashboardData.currentRevenue)}
              </span>
              <span className={`text-white text-xs px-2 py-1 rounded-full ${dashboardData.revenueChange >= 0 ? 'bg-dark' : 'bg-red-600'}`}>
                {dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange.toFixed(1)}%
              </span>
            </div>
            <p className="text-small mt-1">
              {formatCurrencyNoDecimals(dashboardData.lastRevenue)} anno scorso
            </p>
          </div>
          <div className="h-16 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.revenueChartData}>
                 <Bar dataKey="value" fill="#D1F366" radius={[4, 4, 4, 4]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customers Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[180px]">
          <div>
             <h3 className="text-card-title">Progetti Attivi</h3>
             <div className="flex items-center gap-3 mt-2">
                 <span className="text-kpi-value text-dark">{dashboardData.currentProjects}</span>
                 <span className={`text-white text-xs px-2 py-1 rounded-full ${dashboardData.projectsChange >= 0 ? 'bg-dark' : 'bg-red-600'}`}>
                   {dashboardData.projectsChange >= 0 ? '+' : ''}{dashboardData.projectsChange.toFixed(1)}%
                 </span>
             </div>
             <p className="text-small mt-1">{dashboardData.lastProjects} progetti anno scorso</p>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[180px]">
            <div>
                <h3 className="text-card-title">Fatture Totali</h3>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-kpi-value text-dark">{dashboardData.currentTransactions}</span>
                    <span className={`text-white text-xs px-2 py-1 rounded-full ${dashboardData.transactionsChange >= 0 ? 'bg-dark' : 'bg-red-600'}`}>
                      {dashboardData.transactionsChange >= 0 ? '+' : ''}{dashboardData.transactionsChange.toFixed(1)}%
                    </span>
                </div>
                <p className="text-small mt-1">{dashboardData.lastTransactions} fatture anno scorso</p>
            </div>
            <div className="h-16 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.transactionsChartData}>
                        <Line type="monotone" dataKey="sales" stroke="#D1F366" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Andamento Mensile Fatturato */}
      <div className="bg-white p-8 rounded-[2rem] shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-section-title text-dark">Andamento Mensile Fatturato</h3>
          <div className="text-sm text-gray-500">
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
                tick={{ fill: '#6B7280', fontSize: 12 }}
                dy={10}
              />
              <Tooltip
                cursor={{ fill: 'rgba(209, 243, 102, 0.1)' }}
                contentStyle={{
                  backgroundColor: '#111827',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  padding: '12px'
                }}
                itemStyle={{ color: '#fff' }}
                formatter={(value) => formatCurrency(Number(value))}
                labelStyle={{ color: '#D1F366', fontWeight: 'bold' }}
              />
              <Bar dataKey="value" fill="#D1F366" radius={[8, 8, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
