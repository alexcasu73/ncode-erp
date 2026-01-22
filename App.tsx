import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CRM } from './components/CRM';
import { Deals } from './components/Deals';
import { Invoicing } from './components/Invoicing';
import { Cashflow } from './components/Cashflow';
import { FinancialStatement } from './components/FinancialStatement';
import { Reconciliation } from './components/Reconciliation';
import Settings from './components/Settings';
import { UserManagement } from './components/UserManagement';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { RegistrationSuccess } from './components/RegistrationSuccess';
import { ResetPassword } from './components/ResetPassword';
import { SetupPassword } from './components/SetupPassword';
import { ConfirmEmail } from './components/ConfirmEmail';
import { InvoiceNotifications } from './components/InvoiceNotifications';
import { UnifiedImport } from './components/UnifiedImport';
import { Bell, Menu, X, Sun, Moon, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import { useData } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'registration-success' | 'reset-password' | 'setup-password' | 'confirm-email'>('login');
  const [isResetPasswordFlow, setIsResetPasswordFlow] = useState(false);
  const [isSetupPasswordFlow, setIsSetupPasswordFlow] = useState(false);
  const [isConfirmEmailFlow, setIsConfirmEmailFlow] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { aiProcessing, stopAiProcessing, invoiceNotifications } = useData();
  const { user, loading, signOut, showAccountDisabledModal } = useAuth();

  // Check for password reset, setup, or email confirmation flow on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const token = params.get('token');

    // Check if this is an email confirmation flow
    if (token && window.location.pathname.includes('confirm-email')) {
      setIsConfirmEmailFlow(true);
      setAuthView('confirm-email');
    }
    // Check if this is a setup password flow (magic link)
    else if (token && window.location.pathname.includes('setup')) {
      setIsSetupPasswordFlow(true);
      setAuthView('setup-password');
    }
    // Check if this is a password reset flow
    else if (email || type === 'recovery' || accessToken) {
      setIsResetPasswordFlow(true);
      setAuthView('reset-password');
    }
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Show login/register if not authenticated
  if (!user || isResetPasswordFlow || isSetupPasswordFlow || isConfirmEmailFlow) {
    if (authView === 'confirm-email') {
      return <ConfirmEmail onBackToLogin={() => {
        setAuthView('login');
        setIsConfirmEmailFlow(false);
        // Clear URL and redirect to root
        window.history.replaceState({}, '', '/');
      }} />;
    }
    if (authView === 'setup-password') {
      return <SetupPassword onComplete={() => {
        setAuthView('login');
        setIsSetupPasswordFlow(false);
        // Clear URL and redirect to root
        window.history.replaceState({}, '', '/');
      }} />;
    }
    if (authView === 'reset-password') {
      return <ResetPassword onBackToLogin={() => {
        setAuthView('login');
        setIsResetPasswordFlow(false);
        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname);
      }} />;
    }
    if (authView === 'registration-success') {
      return <RegistrationSuccess
        email={registeredEmail}
        onBackToLogin={() => {
          setAuthView('login');
          setRegisteredEmail('');
        }}
      />;
    }
    if (authView === 'register') {
      return <Register
        onBackToLogin={() => setAuthView('login')}
        onRegistrationSuccess={(email) => {
          setRegisteredEmail(email);
          setAuthView('registration-success');
        }}
      />;
    }
    return <Login onRegisterClick={() => setAuthView('register')} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'crm': return <CRM />;
      case 'deals': return <Deals />;
      case 'invoicing': return <Invoicing />;
      case 'cashflow': return <Cashflow />;
      case 'reconciliation': return <Reconciliation />;
      case 'financials': return <FinancialStatement />;
      case 'import': return <UnifiedImport />;
      case 'users': return <UserManagement />;
      case 'profile': return <Profile />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-bg-light dark:bg-dark-bg font-sans text-dark dark:text-white overflow-hidden">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-24 flex items-center justify-between px-4 lg:px-8 bg-bg-light dark:bg-dark-bg flex-shrink-0 border-b border-gray-200 dark:border-dark-border">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
          >
            <Menu size={20} className="text-dark dark:text-white" />
          </button>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Right side buttons */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 bg-white dark:bg-dark-card rounded-lg flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon size={20} className="text-dark dark:text-white" />
              ) : (
                <Sun size={20} className="text-white" />
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative w-10 h-10 bg-white dark:bg-dark-card rounded-lg flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              <Bell size={20} className="text-dark dark:text-white" />
              {invoiceNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-dark-bg">
                  {invoiceNotifications.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Global AI Processing Banner */}
        {aiProcessing.isProcessing && aiProcessing.total > 0 && (
          <div className="px-4 lg:px-8 pt-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="text-purple-600 dark:text-purple-400 animate-spin" />
                <div className="text-sm">
                  <span className="font-medium text-purple-900 dark:text-purple-300">
                    Analisi AI in corso: {aiProcessing.current} / {aiProcessing.total}
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 ml-2">
                    ({Math.round((aiProcessing.current / aiProcessing.total) * 100)}%)
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  console.log('🛑 Global stop button clicked');
                  stopAiProcessing();
                }}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <X size={14} />
                Termina
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-6 min-h-0">
          <div className="h-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Invoice Notifications - Fixed position */}
      <InvoiceNotifications
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      {/* Account Disabled Modal */}
      {showAccountDisabledModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 text-center mb-4">
              Account Disabilitato
            </h2>

            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 text-center">
                Il tuo account è stato disabilitato o eliminato. Verrai disconnesso.
              </p>

              <div className="flex justify-center pt-4">
                <button
                  onClick={async () => {
                    // Sign out and clear everything
                    await supabase.auth.signOut();
                    localStorage.clear();
                    sessionStorage.clear();
                    // Force page reload to login
                    window.location.href = '/';
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;