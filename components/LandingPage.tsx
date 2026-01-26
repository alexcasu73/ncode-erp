import React from 'react';
import { LogIn, Building2, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 dark:from-dark-bg dark:via-dark-bg dark:to-gray-900 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background */}
      <style>{`
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(60px, -80px) rotate(90deg); }
          50% { transform: translate(-40px, -160px) rotate(180deg); }
          75% { transform: translate(80px, -60px) rotate(270deg); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-70px, 60px) rotate(120deg); }
          66% { transform: translate(50px, -50px) rotate(240deg); }
        }
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -100px) scale(1.15); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
      `}</style>

      {/* Floating shapes */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large blurred orange circle - top right */}
        <div
          className="absolute w-96 h-96 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl"
          style={{ top: '-5%', right: '-10%', animation: 'float-3 20s ease-in-out infinite' }}
        />
        {/* Medium emerald blob - bottom left */}
        <div
          className="absolute w-72 h-72 rounded-full bg-emerald-400/10 dark:bg-emerald-400/5 blur-3xl"
          style={{ bottom: '-5%', left: '-8%', animation: 'float-2 25s ease-in-out infinite' }}
        />
        {/* Small purple accent - center left */}
        <div
          className="absolute w-48 h-48 rounded-full bg-violet-400/10 dark:bg-violet-400/5 blur-2xl"
          style={{ top: '30%', left: '5%', animation: 'float-1 18s ease-in-out infinite' }}
        />
        {/* Geometric shapes */}
        <div
          className="absolute w-16 h-16 rounded-xl border border-primary/15 dark:border-primary/10"
          style={{ top: '15%', right: '18%', animation: 'float-1 22s ease-in-out infinite' }}
        />
        <div
          className="absolute w-10 h-10 rounded-lg border border-emerald-400/15 dark:border-emerald-400/10"
          style={{ bottom: '25%', left: '15%', animation: 'float-2 19s ease-in-out infinite' }}
        />
        <div
          className="absolute w-6 h-6 rounded-full bg-primary/15 dark:bg-primary/10"
          style={{ top: '20%', left: '25%', animation: 'float-3 14s ease-in-out infinite' }}
        />
        <div
          className="absolute w-8 h-8 rounded-full bg-violet-400/10 dark:bg-violet-400/5"
          style={{ bottom: '30%', right: '12%', animation: 'float-1 16s ease-in-out infinite' }}
        />
        <div
          className="absolute w-12 h-12 rounded-xl border border-violet-400/10 dark:border-violet-300/5"
          style={{ top: '55%', right: '25%', animation: 'float-2 24s ease-in-out infinite' }}
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-emerald-400/20 dark:bg-emerald-400/10"
          style={{ top: '40%', left: '12%', animation: 'float-1 12s ease-in-out infinite' }}
        />
        {/* Center glow behind card */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full bg-primary/5 dark:bg-primary/[0.03] blur-3xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ animation: 'pulse-glow 8s ease-in-out infinite' }}
        />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10">
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
            className="w-full flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm border border-gray-200 dark:border-dark-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all group"
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
            className="w-full flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm border border-gray-200 dark:border-dark-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all group"
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
      <div className="mt-12 text-center relative z-10">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Powered by</p>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <img src="/ncode-studio-icon.png" alt="Ncode Studio" className="w-3.5 h-3.5 dark:invert dark:opacity-60 opacity-50" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ncode Studio</span>
        </div>
      </div>
    </div>
  );
};
