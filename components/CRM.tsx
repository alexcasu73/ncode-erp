import React from 'react';
import { MOCK_CUSTOMERS } from '../constants';
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone, MapPin, Hash } from 'lucide-react';

export const CRM: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Clienti</h1>
          <p className="text-gray-500 mt-1">Gestisci le relazioni con i clienti</p>
        </div>
        <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
            <Plus size={18} className="text-primary"/>
            Aggiungi Cliente
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Cerca per nome, email o azienda..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
            </div>
            <div className="flex gap-2">
                <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                    <Filter size={20} />
                </button>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4 rounded-tl-2xl">Cliente</th>
                        <th className="px-6 py-4">Stato</th>
                        <th className="px-6 py-4">Azienda</th>
                        <th className="px-6 py-4">Sede & Contatti</th>
                        <th className="px-6 py-4">Fatturato</th>
                        <th className="px-6 py-4 rounded-tr-2xl text-right">Azioni</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {MOCK_CUSTOMERS.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <img className="h-10 w-10 rounded-full object-cover" src={customer.avatar} alt="" />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-dark">{customer.name}</div>
                                        <div className="text-xs text-gray-500">{customer.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    customer.status === 'Attivo' 
                                        ? 'bg-green-100 text-green-800' 
                                        : customer.status === 'Prospetto' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {customer.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-semibold text-dark">{customer.company}</div>
                                <div className="text-xs text-gray-500 flex flex-col gap-0.5 mt-1">
                                    <span title="P.IVA">P.IVA: {customer.vatId}</span>
                                    <span title="Codice SDI">SDI: {customer.sdiCode}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1.5">
                                     <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <MapPin size={14} className="text-gray-400" />
                                        {customer.address}
                                     </div>
                                     <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Phone size={14} className="text-gray-400" />
                                        {customer.phone}
                                     </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark">
                                € {customer.revenue.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <button className="text-gray-400 hover:text-dark p-1">
                                        <Mail size={18} />
                                    </button>
                                    <button className="text-gray-400 hover:text-dark p-1">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-gray-100 text-center">
            <button className="text-sm font-medium text-gray-500 hover:text-dark">Carica altri clienti</button>
        </div>
      </div>
    </div>
  );
};