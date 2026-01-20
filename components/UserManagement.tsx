import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit2, Trash2, Check, X, Shield, UserCog, Eye, ToggleLeft, ToggleRight, Lock, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useUserRole } from '../hooks/useUserRole';
import { sendInvitationEmail } from '../lib/email';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  is_active: boolean;
  created_at: string;
  status?: 'active' | 'pending';
  expires_at?: string;
}

export const UserManagement: React.FC = () => {
  const { companyId, user: currentUser } = useAuth();
  const { getCompanyUsers, createUser, updateUser, deleteUser } = useData();
  const { isAdmin, canManageUsers, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
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
      console.log('🔵 [UserManagement] Starting user invitation for:', formEmail);

      // Validate - only email is required now
      if (!formEmail) {
        setFormError('L\'email è obbligatoria');
        setFormLoading(false);
        return;
      }

      // Use email prefix as temporary name for invitation email
      const tempName = formEmail.split('@')[0];

      // Create invitation with magic link
      console.log('🔵 [UserManagement] Creating invitation via createUser...');
      const { error: createError, data: inviteData } = await createUser({
        email: formEmail,
        name: tempName, // Temporary name, user will provide real name during setup
        role: formRole,
      });

      if (createError) {
        console.error('❌ [UserManagement] Failed to create invitation:', createError);
        setFormError(createError.message || 'Errore nella creazione dell\'invito');
        setFormLoading(false);
        return;
      }

      console.log('✅ [UserManagement] Invitation created:', inviteData);

      // Get company name for email
      const companyName = 'Ncode ERP'; // TODO: Get from context/settings

      // Build magic link with token
      const magicLink = `${window.location.origin}/setup-account?token=${inviteData.token}`;

      console.log('📧 [UserManagement] Sending invitation email...');
      const emailResult = await sendInvitationEmail(companyId!, {
        toEmail: formEmail,
        toName: 'Nuovo Utente', // Generic greeting, user will provide real name
        inviterName: currentUser?.email || 'Admin',
        companyName,
        inviteLink: magicLink,
        role: formRole,
      });

      if (!emailResult.success) {
        console.error('❌ [UserManagement] Email failed:', emailResult.error);
        setFormError(`Invito creato ma errore invio email: ${emailResult.error}`);
        // Reload user list to show pending invitation
        console.log('🔄 [UserManagement] Reloading users after email error...');
        await loadUsers();
      } else {
        console.log('✅ [UserManagement] Email sent successfully');
        // Success - close modal and reload user list
        setShowAddModal(false);
        resetForm();
        console.log('🔄 [UserManagement] Reloading users after success...');
        const usersBeforeReload = users.length;
        await loadUsers();
        console.log('✅ [UserManagement] Users reloaded');
        console.log('   Before reload:', usersBeforeReload, 'users');
        console.log('   After reload:', users.length, 'users');
        // Force a small delay and reload again to ensure fresh data
        setTimeout(async () => {
          console.log('🔄 [UserManagement] Second reload to ensure fresh data...');
          await loadUsers();
          console.log('✅ [UserManagement] Second reload complete, total users:', users.length);
        }, 1000);
      }
    } catch (err) {
      console.error('❌ [UserManagement] Unexpected error:', err);
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

  const handleDeleteUser = (user: User) => {
    // SECURITY: Users cannot delete themselves from User Management
    // They must use Profile > Danger Zone instead
    if (user.id === currentUser?.id) {
      alert("Non puoi eliminare te stesso da questo pannello. Usa la sezione Profilo > Zona Pericolosa per eliminare il tuo account.");
      return;
    }

    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      if (userToDelete.status === 'pending') {
        // Delete pending invitation from user_invitations table
        console.log('🗑️ [UserManagement] Deleting pending invitation:', userToDelete.id);
        const { error } = await supabase
          .from('user_invitations')
          .delete()
          .eq('id', userToDelete.id);

        if (error) {
          console.error('❌ [UserManagement] Error deleting invitation:', error);
          throw error;
        }
        console.log('✅ [UserManagement] Invitation deleted successfully');
      } else {
        // Delete active user
        console.log('🗑️ [UserManagement] Deleting active user:', userToDelete.id);
        await deleteUser(userToDelete.id);
        console.log('✅ [UserManagement] User deleted successfully');
      }

      setShowDeleteModal(false);
      setUserToDelete(null);
      await loadUsers();
      console.log('✅ [UserManagement] User list reloaded after deletion');
    } catch (err: any) {
      console.error('❌ [UserManagement] Error deleting user:', err);
      alert(`Errore nell'eliminazione: ${err.message || 'Errore sconosciuto'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResendInvitation = async (user: User) => {
    if (!companyId) return;

    setResendingInvite(user.id);
    try {
      console.log('📧 [UserManagement] Resending invitation for:', user.email);

      // Get the invitation token from database
      const { data: invitation, error: fetchError } = await supabase
        .from('user_invitations')
        .select('token, role, expires_at')
        .eq('id', user.id)
        .single();

      if (fetchError || !invitation) {
        console.error('❌ [UserManagement] Failed to fetch invitation:', fetchError);
        alert('Errore: impossibile recuperare l\'invito');
        return;
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        alert('L\'invito è scaduto. Elimina questo invito e creane uno nuovo.');
        return;
      }

      // Get company name
      const companyName = 'Ncode ERP'; // TODO: Get from context/settings

      // Build magic link with token
      const magicLink = `${window.location.origin}/setup-account?token=${invitation.token}`;

      console.log('📧 [UserManagement] Sending invitation email...');
      const emailResult = await sendInvitationEmail(companyId, {
        toEmail: user.email,
        toName: user.name,
        inviterName: currentUser?.email || 'Admin',
        companyName,
        inviteLink: magicLink,
        role: invitation.role,
      });

      if (!emailResult.success) {
        console.error('❌ [UserManagement] Email failed:', emailResult.error);
        alert(`Errore invio email: ${emailResult.error}`);
      } else {
        console.log('✅ [UserManagement] Email resent successfully');
        alert('Invito reinviato con successo! ✅');
      }
    } catch (err) {
      console.error('❌ [UserManagement] Unexpected error:', err);
      alert('Errore imprevisto nel reinvio dell\'invito');
    } finally {
      setResendingInvite(null);
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormName('');
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
    <div className="p-6 max-w-6xl mx-auto" style={{ paddingBottom: '20px' }}>
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
                    {user.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <Mail className="text-yellow-600 dark:text-yellow-400" size={20} />
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                          Invito pendente
                        </span>
                      </div>
                    ) : (
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
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {/* Resend invitation button - only for pending invitations */}
                      {user.status === 'pending' && (
                        <button
                          onClick={() => handleResendInvitation(user)}
                          disabled={resendingInvite === user.id}
                          className={`${
                            resendingInvite === user.id
                              ? 'text-gray-400 dark:text-gray-600 cursor-wait opacity-50'
                              : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                          }`}
                          title="Reinvia invito"
                        >
                          {resendingInvite === user.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Mail size={16} />
                          )}
                        </button>
                      )}
                      {/* Edit button - only for active users, not for pending invitations */}
                      {user.status !== 'pending' && (
                        <button
                          onClick={() => openEditModal(user)}
                          disabled={user.id === currentUser?.id || isOnlyAdmin(user)}
                          className={`${
                            user.id === currentUser?.id || isOnlyAdmin(user)
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                          }`}
                          title={
                            user.id === currentUser?.id
                              ? "Non puoi modificare te stesso. Usa la sezione Profilo"
                              : isOnlyAdmin(user)
                              ? "Non puoi modificare l'unico amministratore attivo"
                              : "Modifica"
                          }
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {/* Delete button - for both active users and pending invitations */}
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.status !== 'pending' && (user.id === currentUser?.id || isOnlyAdmin(user))}
                        className={`${
                          user.status !== 'pending' && (user.id === currentUser?.id || isOnlyAdmin(user))
                            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                            : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                        }`}
                        title={
                          user.status === 'pending'
                            ? "Cancella invito"
                            : user.id === currentUser?.id
                            ? "Non puoi eliminare te stesso. Usa la sezione Profilo > Zona Pericolosa"
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
                <>
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

                  {/* Info box about name and password */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Mail size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">
                          Invito via Magic Link
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                          L'utente riceverà un'email con un link sicuro per impostare il proprio <strong>nome</strong> e <strong>password</strong>. Il link è valido per 7 giorni.
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          💡 Non è necessario inserire nome o password: li sceglierà l'invitato durante la registrazione.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Name (only for editing existing users) */}
              {editingUser && (
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 size={24} />
                {userToDelete.status === 'pending' ? 'Cancella Invito' : 'Elimina Utente'}
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={deleteLoading}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Warning Message */}
              <div className={`p-4 border rounded-lg ${
                userToDelete.status === 'pending'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <p className={`text-sm font-medium mb-2 ${
                  userToDelete.status === 'pending'
                    ? 'text-yellow-800 dark:text-yellow-300'
                    : 'text-red-800 dark:text-red-300'
                }`}>
                  {userToDelete.status === 'pending'
                    ? '📧 Stai per cancellare questo invito'
                    : '⚠️ Attenzione: questa azione non può essere annullata!'
                  }
                </p>
                <p className={`text-sm ${
                  userToDelete.status === 'pending'
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {userToDelete.status === 'pending'
                    ? 'L\'invito verrà rimosso e l\'utente non potrà più completare la registrazione con questo link.'
                    : 'Stai per eliminare definitivamente l\'utente:'
                  }
                </p>
              </div>

              {/* User Info */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                    {userToDelete.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-dark dark:text-white">
                      {userToDelete.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {userToDelete.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Ruolo: {userToDelete.role}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation text */}
              {userToDelete.status !== 'pending' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  L'utente verrà rimosso dalla piattaforma e non potrà più accedere al sistema.
                  Tutti i dati associati verranno eliminati.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={deleteLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
                    userToDelete.status === 'pending'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {deleteLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {userToDelete.status === 'pending' ? 'Cancellazione...' : 'Eliminazione...'}
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      {userToDelete.status === 'pending' ? 'Cancella Invito' : 'Elimina Definitivamente'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
