import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

interface UserRoleData {
  role: UserRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isUser: boolean;
  isViewer: boolean;
  loading: boolean;
  canManageUsers: boolean; // Only admin
  canManageCompany: boolean; // Admin and manager
  canViewAll: boolean; // Everyone except viewer
  canEdit: boolean; // Can create/update/delete data (not viewer)
  canDelete: boolean; // Can delete records (not viewer)
  canImport: boolean; // Can import data (only admin and manager)
  canReconcile: boolean; // Can reconcile transactions (only admin and manager)
}

/**
 * Hook to get current user's role and permissions
 * Provides role-based access control (RBAC) utilities
 */
export const useUserRole = (): UserRoleData => {
  const { user, companyId } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !companyId) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('company_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
        } else {
          setRole(data.role as UserRole);
        }
      } catch (err) {
        console.error('Unexpected error fetching role:', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user, companyId]);

  return {
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isUser: role === 'user',
    isViewer: role === 'viewer',
    loading,
    // Permission flags
    canManageUsers: role === 'admin', // Only admins can create/edit/delete users
    canManageCompany: role === 'admin' || role === 'manager', // Admins and managers can manage company data
    canViewAll: role !== 'viewer', // Everyone except viewers can view all data
    canEdit: role !== 'viewer', // Everyone except viewers can create/edit data
    canDelete: role !== 'viewer', // Everyone except viewers can delete data
    canImport: role === 'admin' || role === 'manager', // Only admins and managers can import data
    canReconcile: role === 'admin' || role === 'manager', // Only admins and managers can reconcile
  };
};
