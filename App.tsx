import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CRM } from './components/CRM';
import { Deals } from './components/Deals';
import { Invoicing } from './components/Invoicing';
import { Cashflow } from './components/Cashflow';
import { FinancialStatement } from './components/FinancialStatement';
import { Reconciliation } from './components/Reconciliation';
import { Search, Bell, User } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'crm': return <CRM />;
      case 'deals': return <Deals />;
      case 'invoicing': return <Invoicing />;
      case 'cashflow': return <Cashflow />;
      case 'reconciliation': return <Reconciliation />;
      case 'financials': return <FinancialStatement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans text-dark overflow-hidden">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-8 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center bg-slate-50 rounded-lg px-4 py-2.5 w-full max-w-xl border border-slate-200">
            <Search size={18} className="text-slate-400 mr-3" />
            <input
              type="text"
              placeholder="Cerca qualsiasi cosa..."
              className="bg-transparent border-none outline-none w-full text-sm text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 ml-4">
            <button className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 transition-all duration-150 shadow-sm">
              <Bell size={18} className="text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
            </button>
            <button className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center overflow-hidden shadow-sm hover:shadow transition-all duration-150">
               <img src="https://picsum.photos/100/100?random=user" alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
           {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;