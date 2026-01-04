import React from 'react';
import { MOCK_CUSTOMERS } from '../constants';
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone } from 'lucide-react';

export const CRM: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
            <Plus size={18} className="text-primary"/>
            Add Customer
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Search by name, email or company..." 
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
                        <th className="px-6 py-4 rounded-tl-2xl">Customer</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Company</th>
                        <th className="px-6 py-4">Revenue</th>
                        <th className="px-6 py-4 rounded-tr-2xl text-right">Actions</th>
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
                                    customer.status === 'Active' 
                                        ? 'bg-green-100 text-green-800' 
                                        : customer.status === 'Prospect' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {customer.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {customer.company}
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
                                        <Phone size={18} />
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
            <button className="text-sm font-medium text-gray-500 hover:text-dark">Load more customers</button>
        </div>
      </div>
    </div>
  );
};
