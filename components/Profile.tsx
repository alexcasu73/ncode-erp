import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Save, AlertTriangle, Trash2, Building2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { ImageUpload } from './ImageUpload';

export const Profile: React.FC = () => {
  const { user, companyId } = useAuth();
  const { getCompanyUsers, updateUser, deleteUser } = useData();

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [userRole, setUserRole] = useState('');
  const [isOnlyAdmin, setIsOnlyAdmin] = useState(false);

  // Danger zone modals
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDeleteCompanyModal, setShowDeleteCompanyModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    loadUserData();
  }, [user, companyId]);

  const loadUserData = async () => {
    if (!user || !companyId) return;

    // Load user data from Supabase
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single();

    if (userData) {
      setName(userData.full_name || '');
      setEmail(userData.email);
      setAvatarUrl(userData.avatar_url || '');
    }

    // Load company data
    const { data: companyData } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', companyId)
      .single();

    if (companyData) {
      setCompanyName(companyData.name);
      setCompanyLogoUrl(companyData.logo_url || '');
    }

    // Load user role
    const { data: roleData } = await supabase
      .from('company_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (roleData) {
      setUserRole(roleData.role);
    }

    // Check if user is the only admin
    const users = await getCompanyUsers();
    const admins = users.filter(u => u.role === 'admin' && u.is_active);
    setIsOnlyAdmin(admins.length === 1 && admins[0].id === user.id);
  };

  const handleAvatarUploaded = async (url: string) => {
    try {
      // Update avatar URL in database
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: url })
        .eq('id', user!.id);

      if (error) {
        setError('Errore nell\'aggiornamento dell\'avatar');
        return;
      }

      setAvatarUrl(url);
      setSuccess('Avatar aggiornato con successo!');
      setTimeout(() => setSuccess(''), 3000);

      // Trigger event to update sidebar
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { url } }));
    } catch (err) {
      setError('Errore nell\'upload dell\'avatar');
    }
  };

  const handleCompanyLogoUploaded = async (url: string) => {
    try {
      // Update company logo URL in database
      const { error } = await supabase
        .from('companies')
        .update({ logo_url: url })
        .eq('id', companyId);

      if (error) {
        setError('Errore nell\'aggiornamento del logo aziendale');
        return;
      }

      setCompanyLogoUrl(url);
      setSuccess('Logo aziendale aggiornato con successo!');
      setTimeout(() => setSuccess(''), 3000);

      // Trigger event to update sidebar
      window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { url } }));
    } catch (err) {
      setError('Errore nell\'upload del logo aziendale');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate
      if (!name.trim()) {
        setError('Il nome è obbligatorio');
        setLoading(false);
        return;
      }

      // Update name in users table
      const { error: updateError } = await updateUser(user!.id, { full_name: name.trim() });

      if (updateError) {
        setError(updateError.message || 'Errore nell\'aggiornamento del profilo');
        setLoading(false);
        return;
      }

      setSuccess('Profilo aggiornato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate
      if (newPassword.length < 8) {
        setError('La nuova password deve essere di almeno 8 caratteri');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Le password non corrispondono');
        setLoading(false);
        return;
      }

      // Update password via Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        setError(passwordError.message || 'Errore nel cambio password');
        setLoading(false);
        return;
      }

      setSuccess('Password cambiata con successo!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'ELIMINA') {
      setError('Scrivi "ELIMINA" per confermare');
      return;
    }

    if (isOnlyAdmin) {
      setError('Non puoi eliminare il tuo account: sei l\'unico amministratore. Elimina prima l\'azienda o aggiungi un altro admin.');
      return;
    }

    setLoading(true);
    try {
      await deleteUser(user!.id);
      // User will be logged out automatically
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Errore nell\'eliminazione dell\'account');
      setLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (confirmText !== 'ELIMINA AZIENDA') {
      setError('Scrivi "ELIMINA AZIENDA" per confermare');
      return;
    }

    if (userRole !== 'admin') {
      setError('Solo gli amministratori possono eliminare l\'azienda');
      return;
    }

    setLoading(true);
    try {
      // Use database function to delete company + all auth users
      const { data, error: rpcError } = await supabase.rpc('delete_company_completely', {
        company_id_to_delete: companyId,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Errore nell\'eliminazione dell\'azienda');
      }

      // User will be logged out automatically (session deleted)
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Errore nell\'eliminazione dell\'azienda');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ paddingBottom: '5px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dark dark:text-white flex items-center gap-3">
          <User className="text-primary" size={32} />
          Profilo
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Gestisci il tuo account e le impostazioni
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Company Info */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Building2 size={20} />
          Azienda
        </h2>

        {/* Company Logo Upload - Only for admins */}
        {userRole === 'admin' && (
          <div className="mb-6 flex justify-center">
            <ImageUpload
              currentImageUrl={companyLogoUrl}
              onImageUploaded={handleCompanyLogoUploaded}
              bucket="company-logos"
              folder={companyId!}
              shape="square"
              size="large"
              label="Carica Logo Aziendale"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Nome:</span>
            <span className="text-sm font-medium text-dark dark:text-white">{companyName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ruolo:</span>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              userRole === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              userRole === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              userRole === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            }`}>
              {userRole === 'admin' ? 'Amministratore' :
               userRole === 'manager' ? 'Manager' :
               userRole === 'user' ? 'Utente' : 'Visualizzatore'}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <User size={20} />
          Informazioni Personali
        </h2>

        {/* Avatar Upload */}
        <div className="mb-6 flex justify-center">
          <ImageUpload
            currentImageUrl={avatarUrl}
            onImageUploaded={handleAvatarUploaded}
            bucket="avatars"
            folder={user!.id}
            shape="circle"
            size="large"
            label="Carica Avatar"
          />
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Il tuo nome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              L'email non può essere modificata
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            Salva Modifiche
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
          <Lock size={20} />
          Cambia Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nuova Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Minimo 8 caratteri"
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conferma Nuova Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ripeti la password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Lock size={16} />
            Cambia Password
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border-2 border-red-200 dark:border-red-800 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          Zona Pericolosa
        </h2>

        <div className="space-y-4">
          {/* Delete Account */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-lg border border-red-200 dark:border-red-800">
            <div>
              <h3 className="font-semibold text-dark dark:text-white">Elimina Account</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Elimina permanentemente il tuo account. Questa azione non può essere annullata.
              </p>
              {isOnlyAdmin && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  ⚠️ Sei l'unico amministratore. Aggiungi un altro admin prima di eliminare il tuo account.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              disabled={isOnlyAdmin}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 size={16} />
              Elimina Account
            </button>
          </div>

          {/* Delete Company (only for admins) */}
          {userRole === 'admin' && (
            <div className="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-lg border border-red-200 dark:border-red-800">
              <div>
                <h3 className="font-semibold text-dark dark:text-white">Elimina Azienda</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Elimina permanentemente l'azienda e tutti i dati associati. Questa azione non può essere annullata.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteCompanyModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Elimina Azienda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={24} />
                Elimina Account
              </h2>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setConfirmText('');
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Stai per eliminare permanentemente il tuo account. Questa azione:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>Rimuoverà il tuo accesso all'azienda</li>
                <li>Eliminerà tutti i tuoi dati personali</li>
                <li>Non può essere annullata</li>
              </ul>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scrivi <strong>ELIMINA</strong> per confermare
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="ELIMINA"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteAccountModal(false);
                    setConfirmText('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || confirmText !== 'ELIMINA'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Eliminazione...' : 'Elimina Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Company Modal */}
      {showDeleteCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={24} />
                Elimina Azienda
              </h2>
              <button
                onClick={() => {
                  setShowDeleteCompanyModal(false);
                  setConfirmText('');
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Stai per eliminare permanentemente <strong>{companyName}</strong>. Questa azione:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>Eliminerà <strong>tutti</strong> i dati aziendali (fatture, clienti, flussi di cassa, transazioni, ecc.)</li>
                <li>Eliminerà <strong>tutti gli account utente</strong> associati (inclusi gli account di autenticazione)</li>
                <li>Terminerà <strong>tutte le sessioni attive</strong> degli utenti</li>
                <li><strong>Non può essere annullata</strong> - i dati saranno persi per sempre</li>
              </ul>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scrivi <strong>ELIMINA AZIENDA</strong> per confermare
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="ELIMINA AZIENDA"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteCompanyModal(false);
                    setConfirmText('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteCompany}
                  disabled={loading || confirmText !== 'ELIMINA AZIENDA'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Eliminazione...' : 'Elimina Azienda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
