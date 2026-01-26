import React from 'react';
import { LogIn, Building2, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 dark:from-dark-bg dark:via-dark-bg dark:to-gray-900 flex flex-col items-center justify-center px-4">
      {/* Main Card */}
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-6 shadow-lg shadow-primary/25">
            <span className="text-white font-bold text-3xl">C</span>
          </div>
          <h1 className="text-4xl font-bold text-dark dark:text-white tracking-tight">
            Coalix
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-3 text-lg">
            Gestione aziendale semplice e veloce
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Login */}
          <button
            onClick={onLoginClick}
            className="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                <LogIn size={20} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-dark dark:text-white">Accedi</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hai gia' un account</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
          </button>

          {/* Register */}
          <button
            onClick={onRegisterClick}
            className="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-dark dark:text-white">Registra la tua azienda</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Crea un nuovo account aziendale</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>

      {/* Powered by */}
      <div className="mt-12 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Powered by</p>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <img src="/ncode-studio-icon.png" alt="Ncode Studio" className="w-3.5 h-3.5 dark:invert dark:opacity-60 opacity-50" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ncode Studio</span>
        </div>
      </div>
    </div>
  );
};
