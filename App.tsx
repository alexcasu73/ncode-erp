import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CRM } from './components/CRM';
import { Deals } from './components/Deals';
import { Invoicing } from './components/Invoicing';
import { Cashflow } from './components/Cashflow';
import { FinancialStatement } from './components/FinancialStatement';
import { Reconciliation } from './components/Reconciliation';
import { Bell, User, Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#EAECE6] font-sans text-dark overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, slide in when open */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          currentView={currentView}
          onChangeView={(view) => {
            setCurrentView(view);
            setSidebarOpen(false);
          }}
        />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="h-24 flex items-center justify-between px-4 lg:px-8 bg-[#EAECE6] flex-shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors"
          >
            <Menu size={20} className="text-dark" />
          </button>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Right side buttons */}
          <div className="flex items-center gap-4">
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
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 lg:py-6">
           {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;