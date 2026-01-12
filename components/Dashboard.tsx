import React from 'react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { SALES_DATA, REVENUE_DATA, MOCK_CUSTOMERS } from '../constants';
import { ArrowUpRight, TrendingUp, MoreVertical, Search, Bell } from 'lucide-react';

const COLORS = ['#D1F366', '#E5E7EB']; // Primary Green, Gray

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header Section for Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Panoramica</h1>
          <p className="text-gray-500 mt-1">Informazioni dettagliate sulla tua attività</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-gray-100">
                <span className="text-sm font-medium text-gray-700">Questo mese</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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
            <h3 className="text-lg font-semibold text-gray-800">Fatturato Totale</h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-dark">€ 15.650</span>
              <span className="bg-dark text-white text-xs px-2 py-1 rounded-full">+30,4%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">€ 12.000 mese scorso</p>
          </div>
          <div className="h-16 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_DATA}>
                 <Bar dataKey="value" fill="#D1F366" radius={[4, 4, 4, 4]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customers Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[180px]">
          <div className="flex justify-between items-start">
             <div>
                <h3 className="text-lg font-semibold text-gray-800">Clienti Totali</h3>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-3xl font-bold text-dark">1.226</span>
                    <span className="bg-dark text-white text-xs px-2 py-1 rounded-full">+79,6%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">683 utenti mese scorso</p>
             </div>
             <div className="h-20 w-20 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={[{value: 63}, {value: 37}]}
                        innerRadius={25}
                        outerRadius={35}
                        paddingAngle={0}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                        >
                        <Cell key="cell-0" fill="#D1F366" />
                        <Cell key="cell-1" fill="#f3f4f6" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-dark">
                    63%
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
             <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                Donne
             </div>
             <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                Uomini
             </div>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[180px]">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Ordini Totali</h3>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-3xl font-bold text-dark">15.210</span>
                    <span className="bg-dark text-white text-xs px-2 py-1 rounded-full">+51,3%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">10.056 utenti mese scorso</p>
            </div>
            <div className="h-16 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={SALES_DATA}>
                        <Line type="monotone" dataKey="sales" stroke="#D1F366" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Middle Section: Main Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Sales Analytics Chart */}
         <div className="lg:col-span-3 bg-white p-8 rounded-[2rem] shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-dark">Analisi Vendite</h3>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-primary"></div>
                        Prodotti venduti
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-gray-100"></div>
                        Resi
                    </div>
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SALES_DATA} barGap={0}>
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                            dy={10}
                        />
                        <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="sales" fill="#D1F366" radius={[6, 6, 6, 6]} barSize={16} stackId="a" />
                        <Bar dataKey="returns" fill="#f3f4f6" radius={[6, 6, 6, 6]} barSize={16} stackId="a" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Sales by Country */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-dark">Vendite top per paese</h3>
                <button className="text-sm font-medium underline text-gray-500 hover:text-dark">Vedi tutti</button>
            </div>
            <div className="space-y-6">
                {[
                    { country: 'Stati Uniti', flag: '🇺🇸', percent: 53 },
                    { country: 'Regno Unito', flag: '🇬🇧', percent: 12 },
                    { country: 'Canada', flag: '🇨🇦', percent: 61 },
                ].map((item, idx) => (
                    <div key={idx}>
                        <div className="flex justify-between text-sm font-semibold text-dark mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{item.flag}</span>
                                {item.country}
                            </div>
                            <span>{item.percent}%</span>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary rounded-full" 
                                style={{ width: `${item.percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Product Sales Table */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-dark">Vendite prodotti</h3>
                <button className="text-sm font-medium underline text-gray-500 hover:text-dark">Vedi tutti</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs text-gray-400">
                            <th className="pb-4 font-normal">Articolo</th>
                            <th className="pb-4 font-normal text-right">Scorte</th>
                            <th className="pb-4 font-normal text-right">Prezzo</th>
                            <th className="pb-4 font-normal text-right">Venduti</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {[
                            { name: 'Cardigan maniche corte', price: 55.00, stock: 118, sold: 294, icon: '👕' },
                            { name: 'Shorts lino relax', price: 34.60, stock: 29, sold: 569, icon: '🩳' },
                            { name: 'Felpa donna', price: 22.90, stock: 98, sold: 1629, icon: '🧥' },
                        ].map((product, idx) => (
                            <tr key={idx} className="border-b border-gray-50 last:border-0">
                                <td className="py-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-lg">{product.icon}</div>
                                    <span className="font-medium text-dark truncate max-w-[100px]">{product.name}</span>
                                </td>
                                <td className="py-3 text-right text-gray-500">{product.stock}</td>
                                <td className="py-3 text-right font-medium text-dark">€{product.price}</td>
                                <td className="py-3 text-right text-gray-500">{product.sold}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Last Activity */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-dark">Attività recenti</h3>
                <button className="text-sm font-medium underline text-gray-500 hover:text-dark">Vedi tutti</button>
            </div>
            <div className="space-y-4">
                {MOCK_CUSTOMERS.slice(0, 3).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                            <img src={customer.avatar} alt={customer.name} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                                <h4 className="text-sm font-bold text-dark">{customer.name}</h4>
                                <p className="text-xs text-gray-500">Acquistato <span className="underline decoration-dotted">Blazer misto lino</span></p>
                            </div>
                        </div>
                        <button className="text-gray-400 hover:text-dark">
                            <MoreVertical size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
