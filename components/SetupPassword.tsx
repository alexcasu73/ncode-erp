import React, { useState, useEffect } from 'react';
import { Lock, Mail, User, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface SetupPasswordProps {
  onComplete: () => void;
}

interface InvitationData {
  valid: boolean;
  email?: string;
  role?: string;
  companyName?: string;
  expiresAt?: string;
  error?: string;
}

export const SetupPassword: React.FC<SetupPasswordProps> = ({ onComplete }) => {
  const [token, setToken] = useState<string>('');
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (!urlToken) {
      setError('Link di invito non valido');
      setLoading(false);
      return;
    }

    setToken(urlToken);
    validateToken(urlToken);
  }, []);

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(`${apiUrl}/users/validate-invitation/${tokenToValidate}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setInvitationData({ valid: false, error: data.error || 'Invito non valido o scaduto' });
      } else {
        setInvitationData(data);
      }
    } catch (err) {
      console.error('Error validating token:', err);
      setInvitationData({ valid: false, error: 'Errore nella validazione dell\'invito' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!fullName.trim()) {
      setError('Inserisci il tuo nome completo');
      return;
    }

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/users/complete-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          full_name: fullName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Errore durante la configurazione dell\'account');
        setSubmitting(false);
        return;
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (err) {
      console.error('Error completing invitation:', err);
      setError('Errore di connessione al server');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validazione invito...</p>
        </div>
      </div>
    );
  }

  if (!invitationData?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-200 dark:border-dark-border">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Invito Non Valido
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {invitationData?.error || 'Questo link di invito non è valido o è scaduto.'}
            </p>
          </div>
          <button
            onClick={onComplete}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
          >
            Torna al Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-200 dark:border-dark-border">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Account Configurato!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Il tuo account è stato creato con successo. Verrai reindirizzato al login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-200 dark:border-dark-border">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-dark dark:text-white mb-2">
            Configura il tuo Account
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Benvenuto su Ncode ERP
          </p>
        </div>

        {/* Invitation Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-start gap-3">
            <Mail size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                Invito per {invitationData.companyName}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {invitationData.email}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                Ruolo: <span className="font-medium">{invitationData.role}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={20} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-dark dark:text-white placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={20} className="text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
                className="w-full pl-12 pr-12 py-3 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-dark dark:text-white placeholder-gray-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conferma Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={20} className="text-gray-400" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ripeti la password"
                className="w-full pl-12 pr-12 py-3 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-dark dark:text-white placeholder-gray-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creazione account...</span>
              </>
            ) : (
              <>
                <Lock size={20} />
                <span>Crea Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hai già un account?{' '}
            <button
              onClick={onComplete}
              className="text-primary hover:underline font-medium"
            >
              Accedi qui
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
