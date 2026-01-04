import React from 'react';
import { MOCK_INVOICES } from '../constants';
import { Plus, Download, Printer } from 'lucide-react';

export const Invoicing: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark">Invoices</h1>
          <p className="text-gray-500 mt-1">Billing and payments management</p>
        </div>
        <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
            <Plus size={18} className="text-primary"/>
            Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-red-400">
            <h3 className="text-gray-500 text-sm font-medium">Overdue</h3>
            <p className="text-3xl font-bold text-dark mt-2">€ 12,500.50</p>
            <p className="text-xs text-red-500 mt-1 font-medium">Action required</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-yellow-400">
            <h3 className="text-gray-500 text-sm font-medium">Pending Payment</h3>
            <p className="text-3xl font-bold text-dark mt-2">€ 2,400.00</p>
            <p className="text-xs text-gray-400 mt-1">Due within 30 days</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-primary">
            <h3 className="text-gray-500 text-sm font-medium">Paid this month</h3>
            <p className="text-3xl font-bold text-dark mt-2">€ 5,600.00</p>
            <p className="text-xs text-green-600 mt-1">+12% vs last month</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4 rounded-tl-2xl">Invoice #</th>
                        <th className="px-6 py-4">Client</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 rounded-tr-2xl text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {MOCK_INVOICES.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark">
                                {inv.number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {inv.customerName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(inv.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-dark">
                                € {inv.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    inv.status === 'Paid' 
                                        ? 'bg-green-100 text-green-800' 
                                        : inv.status === 'Pending' 
                                        ? 'bg-yellow-100 text-yellow-800' 
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {inv.status}
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
