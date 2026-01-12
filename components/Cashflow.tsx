import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useData } from '../context/DataContext';
import { Plus, Download, Printer, ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react';

const CASHFLOW_DATA = [
  { month: 'Gen', income: 4000, expense: 2400 },
  { month: 'Feb', income: 3000, expense: 1398 },
  { month: 'Mar', income: 2000, expense: 9800 },
  { month: 'Apr', income: 2780, expense: 3908 },
  { month: 'Mag', income: 1890, expense: 4800 },
  { month: 'Giu', income: 2390, expense: 3800 },
  { month: 'Lug', income: 3490, expense: 4300 },
];

export const Cashflow: React.FC = () => {
  const { transactions, loading } = useData();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Flusso di Cassa</h1>
          <p className="text-gray-500 mt-1">Monitora entrate, uscite e liquidità</p>
        </div>
        <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
            <Plus size={18} className="text-primary"/>
            Registra Transazione
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="text-green-600" size={20} />
                <h3 className="text-gray-500 text-sm font-medium">Entrate Totali</h3>
            </div>
            <p className="text-3xl font-bold text-dark">€ 8.100,00</p>
            <p className="text-xs text-green-600 mt-1 font-medium">+15% vs mese scorso</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-red-400">
            <div className="flex items-center gap-2 mb-2">
                <ArrowDownCircle className="text-red-500" size={20} />
                <h3 className="text-gray-500 text-sm font-medium">Uscite Totali</h3>
            </div>
            <p className="text-3xl font-bold text-dark">€ 1.435,50</p>
            <p className="text-xs text-red-500 mt-1 font-medium">+5% vs mese scorso</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-blue-400">
            <h3 className="text-gray-500 text-sm font-medium">Saldo Netto</h3>
            <p className="text-3xl font-bold text-dark mt-2">€ 6.664,50</p>
            <p className="text-xs text-gray-400 mt-1">Margine operativo 82%</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-8 rounded-[2rem] shadow-sm">
        <h3 className="text-xl font-bold text-dark mb-6">Andamento Temporale</h3>
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CASHFLOW_DATA}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D1F366" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#D1F366" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="income" stroke="#D1F366" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                    <Area type="monotone" dataKey="expense" stroke="#f87171" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
             <h3 className="text-lg font-bold text-dark">Movimenti Recenti</h3>
             <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                <Filter size={20} />
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4 rounded-tl-2xl">Data</th>
                        <th className="px-6 py-4">Descrizione</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Importo</th>
                        <th className="px-6 py-4">Stato</th>
                        <th className="px-6 py-4 rounded-tr-2xl text-right">Azioni</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {transactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(trx.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark">
                                {trx.description}
                                <div className="text-xs text-gray-400 font-normal">{trx.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {trx.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    trx.type === 'Entrata' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {trx.type}
                                </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                                trx.type === 'Entrata' ? 'text-green-600' : 'text-red-500'
                            }`}>
                                {trx.type === 'Entrata' ? '+' : '-'} € {trx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`text-xs font-medium ${
                                    trx.status === 'Completato' ? 'text-gray-600' : 'text-orange-500'
                                }`}>
                                    {trx.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-3">
                                    <button className="text-gray-400 hover:text-dark">
                                        <Download size={18} />
                                    </button>
                                    <button className="text-gray-400 hover:text-dark">
                                        <Printer size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};