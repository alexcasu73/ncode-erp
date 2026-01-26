import React, { useState, useEffect } from 'react';
import { LogIn, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onRegisterClick: () => void;
}

export const Login: React.FC<LoginProps> = ({ onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const { signIn, loginError, clearLoginError } = useAuth();

  // Check for invitation link parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedEmail = params.get('email');
    const invited = params.get('invited');

    if (invited === 'true' && invitedEmail) {
      setEmail(decodeURIComponent(invitedEmail));
      setIsInvited(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearLoginError(); // Clear persistent error from previous attempts
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message || 'Errore durante il login');
      setLoading(false);
    }
    // If successful, the auth state change will redirect automatically
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
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Benvenuto
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Accedi a Coalix
            </p>
          </div>

          {/* Welcome message for invited users */}
          {isInvited && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-semibold">🎉 Benvenuto!</span> La tua email è stata pre-compilata.
                Usa la <strong>password temporanea</strong> che hai ricevuto via email per accedere.
              </p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message - Show persistent error OR local error */}
            {(loginError || error) && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {loginError || error}
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Clear errors when user starts typing
                  if (error) setError('');
                  if (loginError) clearLoginError();
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="tuo@email.it"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  // Clear errors when user starts typing
                  if (error) setError('');
                  if (loginError) clearLoginError();
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••••"
              />
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
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Accedi</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Password dimenticata? Contatta l'amministratore
              </p>
            </div>

            {/* Register Link */}
            <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
              <button
                onClick={onRegisterClick}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-2 py-2"
              >
                <Building2 size={16} />
                <span>Non hai un account? Registra la tua azienda</span>
              </button>
            </div>
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
