import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const CASHFLOW_DATA = [
  { month: 'Jan', income: 4000, expense: 2400 },
  { month: 'Feb', income: 3000, expense: 1398 },
  { month: 'Mar', income: 2000, expense: 9800 },
  { month: 'Apr', income: 2780, expense: 3908 },
  { month: 'May', income: 1890, expense: 4800 },
  { month: 'Jun', income: 2390, expense: 3800 },
  { month: 'Jul', income: 3490, expense: 4300 },
];

export const Cashflow: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Cashflow</h1>
          <p className="text-gray-500 mt-1">Monitor your financial health</p>
        </div>
        <div className="bg-white rounded-full px-4 py-2 text-sm font-medium border border-gray-200">
            Balance: <span className="text-dark font-bold ml-2">€ 67,500</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-sm">
        <h3 className="text-xl font-bold text-dark mb-6">Income vs Expenses</h3>
        <div className="h-[400px] w-full">
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
    </div>
  );
};
