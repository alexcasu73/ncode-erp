import React from 'react';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';

interface RegistrationSuccessProps {
  email: string;
  onBackToLogin: () => void;
}

export const RegistrationSuccess: React.FC<RegistrationSuccessProps> = ({ email, onBackToLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-dark dark:text-white mb-3">
              Account Creato con Successo! 🎉
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Controlla la tua email per completare la registrazione
            </p>
          </div>

          {/* Email Sent Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Email di Conferma Inviata
                </h2>
                <p className="text-blue-800 dark:text-blue-200 mb-3">
                  Abbiamo inviato un'email di conferma a:
                </p>
                <p className="font-mono text-sm bg-white dark:bg-dark-bg px-4 py-2 rounded border border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100 break-all">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-6 mb-8">
            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
              <h3 className="font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm">1</span>
                Controlla la tua casella email
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm ml-8">
                Cerca un'email da <strong>Ncode ERP</strong> con oggetto "Conferma la tua registrazione"
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
              <h3 className="font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm">2</span>
                Clicca sul link di conferma
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm ml-8">
                Apri l'email e clicca sul pulsante <strong>"Conferma Email"</strong> per attivare il tuo account
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
              <h3 className="font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm">3</span>
                Accedi alla piattaforma
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm ml-8">
                Dopo aver confermato l'email, potrai accedere con le tue credenziali
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-5 mb-8">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
              💡 Suggerimenti
            </h4>
            <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2 ml-6 list-disc">
              <li>Controlla anche la cartella <strong>Spam/Posta indesiderata</strong></li>
              <li>L'email potrebbe impiegare alcuni minuti ad arrivare</li>
              <li>Il link di conferma è valido per <strong>24 ore</strong></li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={onBackToLogin}
              className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              <span>Torna al Login</span>
            </button>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Non hai ricevuto l'email? Contatta il supporto o riprova più tardi
            </p>
          </div>
        </div>

        {/* Version */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Ncode ERP v1.0 - Multi-Tenant
          </p>
        </div>
      </div>
    </div>
  );
};
