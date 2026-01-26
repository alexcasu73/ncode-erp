import React, { useState } from 'react';
import { Building2, User, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterProps {
  onBackToLogin: () => void;
  onRegistrationSuccess: (email: string) => void;
}

export const Register: React.FC<RegisterProps> = ({ onBackToLogin, onRegistrationSuccess }) => {
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validazioni
    if (!companyName.trim()) {
      setError('Inserisci il nome dell\'azienda');
      return;
    }
    if (!adminName.trim()) {
      setError('Inserisci il tuo nome');
      return;
    }
    if (!email.trim()) {
      setError('Inserisci l\'email');
      return;
    }
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp({
      companyName: companyName.trim(),
      adminName: adminName.trim(),
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message || 'Errore durante la registrazione');
      setLoading(false);
    } else {
      // Redirect to success page
      onRegistrationSuccess(email.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 dark:from-dark-bg dark:via-dark-bg dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
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
        <div
          className="absolute w-96 h-96 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl"
          style={{ top: '-5%', right: '-10%', animation: 'float-3 20s ease-in-out infinite' }}
        />
        <div
          className="absolute w-72 h-72 rounded-full bg-emerald-400/10 dark:bg-emerald-400/5 blur-3xl"
          style={{ bottom: '-5%', left: '-8%', animation: 'float-2 25s ease-in-out infinite' }}
        />
        <div
          className="absolute w-48 h-48 rounded-full bg-violet-400/10 dark:bg-violet-400/5 blur-2xl"
          style={{ top: '30%', left: '5%', animation: 'float-1 18s ease-in-out infinite' }}
        />
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
        <div
          className="absolute w-[500px] h-[500px] rounded-full bg-primary/5 dark:bg-primary/[0.03] blur-3xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ animation: 'pulse-glow 8s ease-in-out infinite' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Registra la tua Azienda
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Crea il tuo account aziendale su Coalix
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Azienda
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Es. Ncode Studio"
                />
              </div>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Amministratore
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Es. Mario Rossi"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="admin@tuaazienda.it"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Minimo 8 caratteri"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Conferma Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ripeti la password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Registrazione in corso...</span>
                </>
              ) : (
                <>
                  <Building2 size={20} />
                  <span>Registra Azienda</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6">
            <button
              onClick={onBackToLogin}
              className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Hai già un account? Accedi</span>
            </button>
          </div>
        </div>

        {/* Powered by */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Powered by</p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <img src="/ncode-studio-icon.png" alt="Ncode Studio" className="w-3.5 h-3.5 dark:invert dark:opacity-60 opacity-50" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ncode Studio</span>
          </div>
        </div>
      </div>
    </div>
  );
};
