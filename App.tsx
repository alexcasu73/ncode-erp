import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CRM } from './components/CRM';
import { Deals } from './components/Deals';
import { Invoicing } from './components/Invoicing';
import { Cashflow } from './components/Cashflow';
import { FinancialStatement } from './components/FinancialStatement';
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
      case 'financials': return <FinancialStatement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#EAECE6] font-sans text-dark overflow-hidden">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="h-24 flex items-center justify-between px-4 lg:px-8 bg-[#EAECE6] flex-shrink-0">
          <div className="flex items-center bg-white rounded-full px-4 py-2.5 w-full max-w-md shadow-sm">
            <Search size={20} className="text-gray-400 mr-3" />
            <input 
              type="text" 
              placeholder="Cerca qualsiasi cosa..." 
              className="bg-transparent border-none outline-none w-full text-sm text-dark placeholder-gray-400"
            />
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            <button className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
              <Bell size={20} className="text-dark" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <button className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-sm overflow-hidden">
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