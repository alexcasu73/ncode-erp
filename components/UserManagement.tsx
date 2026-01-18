import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit2, Trash2, Check, X, Shield, UserCog, Eye, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useUserRole } from '../hooks/useUserRole';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  is_active: boolean;
  created_at: string;
}

export const UserManagement: React.FC = () => {
  const { companyId, user: currentUser } = useAuth();
  const { getCompanyUsers, createUser, updateUser, deleteUser } = useData();
  const { isAdmin, canManageUsers, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'manager' | 'user' | 'viewer'>('user');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const data = await getCompanyUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      // Validate
      if (!formEmail || !formName || !formPassword) {
        setFormError('Tutti i campi sono obbligatori');
        setFormLoading(false);
        return;
      }

      if (formPassword.length < 8) {
        setFormError('La password deve essere di almeno 8 caratteri');
        setFormLoading(false);
        return;
      }

      const { error } = await createUser({
        email: formEmail,
        name: formName,
        password: formPassword,
        role: formRole,
      });

      if (error) {
        setFormError(error.message || 'Errore nella creazione dell\'utente');
      } else {
        // Success
        setShowAddModal(false);
        resetForm();
        loadUsers();
      }
    } catch (err) {
      setFormError('Errore imprevisto');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Prevent changing role of only admin to non-admin
    if (isOnlyAdmin(editingUser) && formRole !== 'admin') {
      setFormError("Non puoi cambiare il ruolo dell'unico amministratore attivo. Aggiungi un altro amministratore prima di procedere.");
      return;
    }

    setFormError('');
    setFormLoading(true);

    try {
      const { error } = await updateUser(editingUser.id, {
        name: formName,
        role: formRole,
      });

      if (error) {
        setFormError(error.message || 'Errore nell\'aggiornamento dell\'utente');
      } else {
        setEditingUser(null);
        resetForm();
        loadUsers();
      }
    } catch (err) {
      setFormError('Errore imprevisto');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    // SECURITY: Users cannot disable themselves
    if (user.id === currentUser?.id) {
      alert("Non puoi disattivare te stesso. Usa la sezione Profilo per gestire il tuo account.");
      return;
    }

    // Prevent deactivating the only active admin
    if (user.is_active && isOnlyAdmin(user)) {
      alert("Non puoi disattivare l'unico amministratore attivo. Aggiungi un altro amministratore prima di procedere.");
      return;
    }

    try {
      await updateUser(user.id, {
        is_active: !user.is_active,
      });
      loadUsers();
    } catch (err) {
      console.error('Error toggling user active status:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // SECURITY: Users cannot delete themselves from User Management
    // They must use Profile > Danger Zone instead
    if (userId === currentUser?.id) {
      alert("Non puoi eliminare te stesso da questo pannello. Usa la sezione Profilo > Zona Pericolosa per eliminare il tuo account.");
      return;
    }

    if (!confirm('Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Errore nell\'eliminazione dell\'utente');
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormName('');
    setFormPassword('');
    setFormRole('user');
    setFormError('');
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user: User) => {
    setFormName(user.name);
    setFormRole(user.role);
    setEditingUser(user);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'manager': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'user': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'viewer': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Amministratore';
      case 'manager': return 'Manager';
      case 'user': return 'Utente';
      case 'viewer': return 'Visualizzatore';
      default: return role;
    }
  };

  const isOnlyAdmin = (user: User) => {
    const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active);
    return activeAdmins.length === 1 && activeAdmins[0].id === user.id;
  };

  // Permission check: Only admins can access user management
  if (roleLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifica permessi...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <Lock size={48} className="mx-auto mb-4 text-red-600 dark:text-red-400" />
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-300 mb-2">Accesso Negato</h2>
          <p className="text-red-700 dark:text-red-400 mb-4">
            Non hai i permessi necessari per accedere alla gestione utenti.
          </p>
          <p className="text-sm text-red-600 dark:text-red-500">
            Solo gli amministratori possono creare, modificare ed eliminare utenti.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Torna Indietro
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Caricamento utenti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark dark:text-white flex items-center gap-3">
            <Users className="text-primary" size={32} />
            Gestione Utenti
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Gestisci gli utenti della tua azienda
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all shadow-sm"
        >
          <UserPlus size={20} />
          Aggiungi Utente
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-dark-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-dark dark:text-white">
                          {user.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={user.id === currentUser?.id}
                      className={`flex items-center gap-2 ${
                        user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={user.id === currentUser?.id ? "Non puoi disattivare te stesso" : ""}
                    >
                      {user.is_active ? (
                        <>
                          <ToggleRight className="text-green-600 dark:text-green-400" size={24} />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Attivo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-gray-400" size={24} />
                          <span className="text-xs text-gray-400 font-medium">Disattivo</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        title="Modifica"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={isOnlyAdmin(user) || user.id === currentUser?.id}
                        className={`${
                          isOnlyAdmin(user) || user.id === currentUser?.id
                            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                            : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                        }`}
                        title={
                          user.id === currentUser?.id
                            ? "Non puoi eliminare te stesso da questo pannello"
                            : isOnlyAdmin(user)
                            ? "Non puoi eliminare l'unico amministratore attivo"
                            : "Elimina"
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 dark:text-gray-400">Nessun utente trovato</p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-dark dark:text-white flex items-center gap-2">
                {editingUser ? <Edit2 size={24} /> : <UserPlus size={24} />}
                {editingUser ? 'Modifica Utente' : 'Aggiungi Utente'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-4">
              {/* Error Message */}
              {formError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}

              {/* Email (only for new users) */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="utente@example.com"
                  />
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Mario Rossi"
                />
              </div>

              {/* Password (only for new users) */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Minimo 8 caratteri"
                    minLength={8}
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ruolo
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="admin">Amministratore (tutto l'accesso)</option>
                  <option value="manager">Manager (gestione fatture e flussi)</option>
                  <option value="user">Utente (operazioni base)</option>
                  <option value="viewer">Visualizzatore (sola lettura)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {editingUser ? 'Salvataggio...' : 'Creazione...'}
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      {editingUser ? 'Salva' : 'Crea Utente'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
