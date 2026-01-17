import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Key, AlertCircle, CheckCircle, Sparkles, Bell } from 'lucide-react';
import { useData } from '../context/DataContext';

const Settings: React.FC = () => {
  const { settings: dbSettings, updateSettings, getSettings } = useData();

  const [defaultProvider, setDefaultProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [notificationRefreshInterval, setNotificationRefreshInterval] = useState<1 | 3 | 5>(5);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      if (settings) {
        setDefaultProvider(settings.defaultAiProvider);
        setAnthropicApiKey(settings.anthropicApiKey);
        setOpenaiApiKey(settings.openaiApiKey);
        // Cast to correct type
        const interval = settings.notificationRefreshInterval || 5;
        setNotificationRefreshInterval([1, 3, 5].includes(interval) ? interval as 1 | 3 | 5 : 5);
      }
    };
    loadSettings();
  }, [getSettings]);

  // Removed second useEffect to prevent conflicts with user input

  // Debug: log when notificationRefreshInterval changes
  useEffect(() => {
    console.log(`[Settings] notificationRefreshInterval state changed to:`, notificationRefreshInterval);
  }, [notificationRefreshInterval]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const success = await updateSettings({
        defaultAiProvider: defaultProvider,
        anthropicApiKey,
        openaiApiKey,
        notificationRefreshInterval
      });

      if (success) {
        // Also save to localStorage as cache for faster access
        localStorage.setItem('ai_settings', JSON.stringify({
          defaultProvider,
          anthropicApiKey,
          openaiApiKey
        }));
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const isAnthropicKeyValid = anthropicApiKey.length > 0;
  const isOpenAIKeyValid = openaiApiKey.length > 0;

  const handleIntervalChange = (interval: 1 | 3 | 5) => {
    console.log(`[Settings] Changing notification interval to ${interval} minutes`);
    console.log(`[Settings] Current value before change:`, notificationRefreshInterval, typeof notificationRefreshInterval);
    setNotificationRefreshInterval(interval);
    console.log(`[Settings] Called setNotificationRefreshInterval with:`, interval);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dark dark:text-white flex items-center gap-3">
          <Sparkles className="text-primary" size={32} />
          Impostazioni AI
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Configura i provider AI per la riconciliazione bancaria automatica
        </p>
      </div>

      {/* Default Provider Selection */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Key size={20} />
          Provider Predefinito
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Seleziona il provider AI da utilizzare di default per la riconciliazione
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setDefaultProvider('anthropic')}
            className={`p-4 rounded-lg border-2 transition-all ${
              defaultProvider === 'anthropic'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                defaultProvider === 'anthropic' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                <span className="text-lg font-bold">C</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark dark:text-white">Anthropic Claude</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Haiku, Sonnet, Opus</div>
              </div>
            </div>
            {defaultProvider === 'anthropic' && (
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle size={14} />
                Selezionato
              </div>
            )}
          </button>

          <button
            onClick={() => setDefaultProvider('openai')}
            className={`p-4 rounded-lg border-2 transition-all ${
              defaultProvider === 'openai'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                defaultProvider === 'openai' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                <span className="text-lg font-bold">⚡</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark dark:text-white">OpenAI</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">GPT-4o, GPT-4, GPT-3.5</div>
              </div>
            </div>
            {defaultProvider === 'openai' && (
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle size={14} />
                Selezionato
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Anthropic API Key */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">C</span>
              </div>
              Anthropic Claude
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Ottieni la tua API key da{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
          {isAnthropicKeyValid && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle size={16} />
              Configurato
            </div>
          )}
        </div>

        <div className="relative">
          <input
            type={showAnthropicKey ? 'text' : 'password'}
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowAnthropicKey(!showAnthropicKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white"
          >
            {showAnthropicKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <strong>Modelli disponibili:</strong> Haiku 3.5 (~15¢/100 tx), Sonnet 3.5 (~$1.50/100 tx), Sonnet 4 (~$3/100 tx), Opus 3 (~$7.50/100 tx), Opus 4.5 (~$15/100 tx)
        </div>
      </div>

      {/* OpenAI API Key */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">⚡</span>
              </div>
              OpenAI
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Ottieni la tua API key da{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com
              </a>
            </p>
          </div>
          {isOpenAIKeyValid && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle size={16} />
              Configurato
            </div>
          )}
        </div>

        <div className="relative">
          <input
            type={showOpenAIKey ? 'text' : 'password'}
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white"
          >
            {showOpenAIKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <strong>Modelli disponibili:</strong> GPT-4o (~$0.50/100 tx), GPT-4o-mini (~$0.05/100 tx), GPT-4 Turbo (~$2/100 tx), GPT-3.5 Turbo (~$0.15/100 tx)
        </div>
      </div>

      {/* Notification Refresh Interval */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Bell size={20} />
          Notifiche Fatture
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Configura ogni quanto controllare le scadenze delle fatture
        </p>

        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handleIntervalChange(1)}
            className={`p-4 rounded-lg border-2 transition-all ${
              Number(notificationRefreshInterval) === 1
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-dark dark:text-white mb-1">1</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">minuto</div>
            </div>
            {Number(notificationRefreshInterval) === 1 && (
              <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium mt-2">
                <CheckCircle size={14} />
                Attivo
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleIntervalChange(3)}
            className={`p-4 rounded-lg border-2 transition-all ${
              Number(notificationRefreshInterval) === 3
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-dark dark:text-white mb-1">3</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">minuti</div>
            </div>
            {Number(notificationRefreshInterval) === 3 && (
              <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium mt-2">
                <CheckCircle size={14} />
                Attivo
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleIntervalChange(5)}
            className={`p-4 rounded-lg border-2 transition-all ${
              Number(notificationRefreshInterval) === 5
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-dark dark:text-white mb-1">5</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">minuti</div>
            </div>
            {Number(notificationRefreshInterval) === 5 && (
              <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium mt-2">
                <CheckCircle size={14} />
                Attivo
              </div>
            )}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Il sistema controllerà automaticamente le scadenze delle fatture ogni {notificationRefreshInterval} {notificationRefreshInterval === 1 ? 'minuto' : 'minuti'}
        </div>
      </div>

      {/* Warning if no key configured */}
      {!isAnthropicKeyValid && !isOpenAIKeyValid && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                Nessuna API key configurata
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-400">
                Configura almeno una API key per utilizzare la riconciliazione AI automatica.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Le API key vengono salvate in modo permanente nel database
        </div>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
        >
          {saveStatus === 'saving' ? (
            <>
              <Save size={18} className="animate-pulse" />
              Salvataggio...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <CheckCircle size={18} />
              Salvato!
            </>
          ) : (
            <>
              <Save size={18} />
              Salva Impostazioni
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;
