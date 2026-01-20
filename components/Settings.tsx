import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Key, AlertCircle, CheckCircle, Sparkles, Bell, Mail, Send } from 'lucide-react';
import { useData } from '../context/DataContext';
import { testSmtpConfiguration } from '../lib/email';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { settings: dbSettings, updateSettings, getSettings } = useData();
  const { companyId } = useAuth();

  const [defaultProvider, setDefaultProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notificationRefreshInterval, setNotificationRefreshInterval] = useState<1 | 3 | 5>(5);

  // Email provider
  const [emailProvider, setEmailProvider] = useState<'smtp' | 'google-oauth2'>('smtp');

  // Sincronizza automaticamente lo stato "enabled" con il provider selezionato
  const handleEmailProviderChange = (provider: 'smtp' | 'google-oauth2') => {
    setEmailProvider(provider);
    if (provider === 'smtp') {
      setSmtpEnabled(true);
      setGoogleOauth2Enabled(false);
    } else {
      setSmtpEnabled(false);
      setGoogleOauth2Enabled(true);
    }
  };

  // SMTP Settings
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Google OAuth2 Settings
  const [googleOauth2Enabled, setGoogleOauth2Enabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [googleFromName, setGoogleFromName] = useState('');
  const [showGoogleClientSecret, setShowGoogleClientSecret] = useState(false);
  const [showGoogleRefreshToken, setShowGoogleRefreshToken] = useState(false);

  // Load settings from database on mount ONCE
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      if (settings) {
        setDefaultProvider(settings.defaultAiProvider);
        setAnthropicApiKey(settings.anthropicApiKey);
        setOpenaiApiKey(settings.openaiApiKey);
        setNotificationRefreshInterval(settings.notificationRefreshInterval || 5);

        // Load email provider
        const provider = settings.emailProvider || 'smtp';
        setEmailProvider(provider);

        // Load SMTP settings
        setSmtpEnabled(provider === 'smtp' || settings.smtpEnabled || false);
        setSmtpHost(settings.smtpHost || 'smtp.gmail.com');
        setSmtpPort(settings.smtpPort || 587);
        setSmtpSecure(settings.smtpSecure || false);
        setSmtpUser(settings.smtpUser || '');
        setSmtpPassword(settings.smtpPassword || '');
        setSmtpFromName(settings.smtpFromName || '');
        setSmtpFromEmail(settings.smtpFromEmail || '');

        // Load Google OAuth2 settings
        setGoogleOauth2Enabled(provider === 'google-oauth2' || settings.googleOauth2Enabled || false);
        setGoogleClientId(settings.googleClientId || '');
        setGoogleClientSecret(settings.googleClientSecret || '');
        setGoogleRefreshToken(settings.googleRefreshToken || '');
        setGoogleUserEmail(settings.googleUserEmail || '');
        setGoogleFromName(settings.googleFromName || '');

        // IMPORTANT: Also save AI keys to localStorage for reconciliation-ai.ts to use
        // reconciliation-ai.ts reads from localStorage only, not from database
        if (settings.anthropicApiKey || settings.openaiApiKey) {
          localStorage.setItem('ai_settings', JSON.stringify({
            defaultProvider: settings.defaultAiProvider,
            anthropicApiKey: settings.anthropicApiKey,
            openaiApiKey: settings.openaiApiKey
          }));
          console.log('[Settings] Synced AI keys from database to localStorage');
        }
      }
    };
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Removed second useEffect to prevent conflicts with user input

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const success = await updateSettings({
        defaultAiProvider: defaultProvider,
        anthropicApiKey,
        openaiApiKey,
        notificationRefreshInterval,
        emailProvider,
        smtpEnabled,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPassword,
        smtpFromName,
        smtpFromEmail,
        googleOauth2Enabled,
        googleClientId,
        googleClientSecret,
        googleRefreshToken,
        googleUserEmail,
        googleFromName,
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

  const handleTestSmtp = async () => {
    if (!testEmail) {
      setSmtpTestResult({ success: false, message: 'Inserisci un\'email di test' });
      return;
    }

    setTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      const result = await testSmtpConfiguration(companyId!, testEmail);
      setSmtpTestResult({
        success: result.success,
        message: result.success ? 'Email di test inviata con successo!' : result.error || 'Errore invio email'
      });
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message || 'Errore imprevisto' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const isAnthropicKeyValid = anthropicApiKey.length > 0;
  const isOpenAIKeyValid = openaiApiKey.length > 0;

  return (
    <div className="p-6 pb-8 max-w-4xl mx-auto">
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

      {/* Notification Settings */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Bell size={20} />
          Impostazioni Notifiche
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Configura la frequenza di controllo delle scadenze fatture
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Intervallo Refresh Notifiche
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Ogni quanto controllare le fatture in scadenza
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setNotificationRefreshInterval(1)}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                notificationRefreshInterval === 1
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                  : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-semibold">1 minuto</div>
              <div className="text-xs opacity-70">Frequente</div>
            </button>
            <button
              onClick={() => setNotificationRefreshInterval(3)}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                notificationRefreshInterval === 3
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                  : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-semibold">3 minuti</div>
              <div className="text-xs opacity-70">Equilibrato</div>
            </button>
            <button
              onClick={() => setNotificationRefreshInterval(5)}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                notificationRefreshInterval === 5
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                  : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-semibold">5 minuti</div>
              <div className="text-xs opacity-70">Risparmio</div>
            </button>
          </div>
        </div>
      </div>

      {/* Email Provider Selection */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Mail size={20} />
          Provider Email per Inviti
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Seleziona come inviare le email di invito ai nuovi utenti
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleEmailProviderChange('smtp')}
            className={`p-4 rounded-lg border-2 transition-all ${
              emailProvider === 'smtp'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                emailProvider === 'smtp' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                <Mail size={20} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark dark:text-white">SMTP Tradizionale</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Gmail, Outlook, ecc.</div>
              </div>
            </div>
            {emailProvider === 'smtp' && (
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle size={14} />
                Selezionato
              </div>
            )}
          </button>

          <button
            onClick={() => handleEmailProviderChange('google-oauth2')}
            className={`p-4 rounded-lg border-2 transition-all ${
              emailProvider === 'google-oauth2'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                emailProvider === 'google-oauth2' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                <span className="text-lg font-bold">G</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark dark:text-white">Google OAuth2</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Consigliato per Gmail</div>
              </div>
            </div>
            {emailProvider === 'google-oauth2' && (
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle size={14} />
                Selezionato
              </div>
            )}
          </button>
        </div>
      </div>

      {/* SMTP Configuration for Email Invitations */}
      {emailProvider === 'smtp' && (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
              <Mail size={20} />
              Configurazione SMTP
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configura SMTP tradizionale per inviare inviti via email
            </p>
          </div>

        {true && (
          <div className="space-y-4">
            {/* Gmail Quick Setup */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">📧 Configurazione Gmail</h3>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Abilita la verifica in due passaggi su Gmail</li>
                <li>Vai su <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">myaccount.google.com/apppasswords</a></li>
                <li>Crea una "Password per l'app" per "Mail"</li>
                <li>Usa la password generata nel campo "Password SMTP" qui sotto</li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* SMTP Host */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Host SMTP
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* SMTP Port */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Porta
                </label>
                <select
                  value={smtpPort}
                  onChange={(e) => {
                    const port = parseInt(e.target.value);
                    setSmtpPort(port);
                    setSmtpSecure(port === 465);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="587">587 (TLS/STARTTLS)</option>
                  <option value="465">465 (SSL)</option>
                  <option value="25">25 (non crittografato)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* SMTP User */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username / Email
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="tuoemail@gmail.com"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password SMTP
                </label>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="Password app Gmail"
                    className="w-full px-4 pr-12 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white"
                  >
                    {showSmtpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* From Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome Mittente
                </label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  placeholder="Ncode ERP"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* From Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Mittente
                </label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="noreply@tuodominio.com"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Test SMTP */}
            <div className="border-t border-gray-200 dark:border-dark-border pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Testa Configurazione SMTP
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Email di test"
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !testEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingSmtp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Invio...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Invia Test
                    </>
                  )}
                </button>
              </div>

              {smtpTestResult && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  smtpTestResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-sm ${
                    smtpTestResult.success
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {smtpTestResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Google OAuth2 Configuration */}
      {emailProvider === 'google-oauth2' && (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
              <span className="text-xl">G</span>
              Configurazione Google OAuth2
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Usa OAuth2 per inviare email via Gmail (consigliato)
            </p>
          </div>

          {true && (
            <div className="space-y-4">
              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">ℹ️ Vantaggi di Google OAuth2</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Il refresh token non scade mai</li>
                  <li>Più sicuro delle password App</li>
                  <li>Usa l'API Gmail ufficiale</li>
                  <li>Migliore deliverability</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Client ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Google Client ID
                  </label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxxx.apps.googleusercontent.com"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  />
                </div>

                {/* Client Secret */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Google Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showGoogleClientSecret ? 'text' : 'password'}
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder="GOCSPX-xxxxx"
                      className="w-full px-4 pr-12 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGoogleClientSecret(!showGoogleClientSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white"
                    >
                      {showGoogleClientSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Refresh Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Google Refresh Token
                </label>
                <div className="relative">
                  <input
                    type={showGoogleRefreshToken ? 'text' : 'password'}
                    value={googleRefreshToken}
                    onChange={(e) => setGoogleRefreshToken(e.target.value)}
                    placeholder="1//04xxxxx"
                    className="w-full px-4 pr-12 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleRefreshToken(!showGoogleRefreshToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white"
                  >
                    {showGoogleRefreshToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Gmail User Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gmail Account
                  </label>
                  <input
                    type="email"
                    value={googleUserEmail}
                    onChange={(e) => setGoogleUserEmail(e.target.value)}
                    placeholder="team@ncodestudio.it"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* From Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome Mittente
                  </label>
                  <input
                    type="text"
                    value={googleFromName}
                    onChange={(e) => setGoogleFromName(e.target.value)}
                    placeholder="Ncode ERP"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Test Google OAuth2 */}
              <div className="border-t border-gray-200 dark:border-dark-border pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Testa Configurazione Google OAuth2
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Email di test"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={testingSmtp || !testEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingSmtp ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Invio...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Invia Test
                      </>
                    )}
                  </button>
                </div>

                {smtpTestResult && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    smtpTestResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <p className={`text-sm ${
                      smtpTestResult.success
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {smtpTestResult.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
