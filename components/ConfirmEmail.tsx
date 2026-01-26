import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

interface ConfirmEmailProps {
  onBackToLogin: () => void;
}

export const ConfirmEmail: React.FC<ConfirmEmailProps> = ({ onBackToLogin }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Get token from URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
          setStatus('error');
          setMessage('Token di conferma mancante o non valido');
          return;
        }

        // Call backend to confirm email
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/auth/confirm-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok) {
          setStatus('error');
          setMessage(result.error || 'Errore nella conferma dell\'email');
          return;
        }

        setStatus('success');
        setMessage('Email confermata con successo! Ora puoi accedere con le tue credenziali.');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          onBackToLogin();
        }, 3000);

      } catch (err) {
        console.error('Error confirming email:', err);
        setStatus('error');
        setMessage('Si è verificato un errore durante la conferma dell\'email');
      }
    };

    confirmEmail();
  }, [onBackToLogin]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Conferma Email
            </h1>
          </div>

          {/* Status */}
          <div className="space-y-4">
            {status === 'loading' && (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Conferma in corso...
                </p>
              </div>
            )}

            {status === 'success' && (
              <>
                <div className="flex flex-col items-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
                    {message}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Verrai reindirizzato alla pagina di login tra pochi secondi...
                  </p>
                </div>
                <button
                  onClick={onBackToLogin}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
                >
                  Vai al Login
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex flex-col items-center">
                  <XCircle className="w-16 h-16 text-red-500 mb-4" />
                  <p className="text-center text-red-600 dark:text-red-400 mb-4">
                    {message}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Il link potrebbe essere scaduto o già utilizzato.
                  </p>
                </div>
                <button
                  onClick={onBackToLogin}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
                >
                  Torna al Login
                </button>
              </>
            )}
          </div>
        </div>

        {/* Version */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Coalix v1.0
          </p>
        </div>
      </div>
    </div>
  );
};
