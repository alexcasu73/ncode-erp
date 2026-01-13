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
    <div className="flex flex-col lg:flex-row min-h-screen bg-dark font-sans text-text-primary overflow-hidden">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="h-24 flex items-center justify-between px-4 lg:px-8 bg-dark border-b border-dark-lighter flex-shrink-0">
          <div className="flex items-center bg-secondary rounded-full px-4 py-2.5 w-full max-w-md border border-dark-lighter">
            <Search size={20} className="text-muted mr-3" />
            <input
              type="text"
              placeholder="Cerca qualsiasi cosa..."
              className="bg-transparent border-none outline-none w-full text-sm text-text-primary placeholder-muted"
            />
          </div>

          <div className="flex items-center gap-4 ml-4">
            <button className="relative w-10 h-10 bg-secondary rounded-full flex items-center justify-center border border-dark-lighter hover:bg-dark-lighter transition-colors">
              <Bell size={20} className="text-text-primary" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border border-secondary"></span>
            </button>
            <button className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden">
               <img src="https://picsum.photos/100/100?random=user" alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 pb-8">
           {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;