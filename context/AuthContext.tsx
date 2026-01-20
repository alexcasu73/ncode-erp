import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface SignUpData {
  companyName: string;
  adminName: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  companyId: string | null;
  loading: boolean;
  loginError: string | null;
  clearLoginError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserCompany(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserCompany(session.user.id);
      } else {
        setCompanyId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserCompany = async (userId: string) => {
    try {
      // Get user's company from company_users table
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching user company:', error);
        setCompanyId(null);
      } else {
        setCompanyId(data.company_id);
      }
    } catch (err) {
      console.error('Error in fetchUserCompany:', err);
      setCompanyId(null);
    } finally {
      setLoading(false);
    }
  };

  const clearLoginError = () => {
    setLoginError(null);
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Clear any previous login error
      setLoginError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (!data.user) {
        return { error: new Error('Errore nel login') };
      }

      // SECURITY: Check if user is active (is_active = true)
      const { data: companyUser, error: companyUserError } = await supabase
        .from('company_users')
        .select('is_active, company_id')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (companyUserError || !companyUser) {
        // User is disabled or not found
        console.log('🚫 User is disabled or not found in company_users');

        const errorMessage = 'Account disabilitato. Contatta l\'amministratore.';

        // Set persistent error message
        setLoginError(errorMessage);

        // Sign out the user
        await supabase.auth.signOut();

        return { error: new Error(errorMessage) };
      }

      console.log('✅ User is active, login successful');
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      // Generate a unique slug from company name
      const generateSlug = (name: string): string => {
        const baseSlug = name
          .toLowerCase()
          .trim()
          .replace(/[àáâãäå]/g, 'a')
          .replace(/[èéêë]/g, 'e')
          .replace(/[ìíîï]/g, 'i')
          .replace(/[òóôõö]/g, 'o')
          .replace(/[ùúûü]/g, 'u')
          .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

        // Add timestamp to ensure uniqueness
        const timestamp = Date.now().toString(36);
        return `${baseSlug}-${timestamp}`;
      };

      const companySlug = generateSlug(data.companyName);

      // 1. Create company using database function (bypasses RLS during registration)
      const { data: newCompanyId, error: companyError } = await supabase
        .rpc('create_company_for_registration', {
          company_name: data.companyName,
          company_slug: companySlug,
        });

      if (companyError || !newCompanyId) {
        console.error('Error creating company:', companyError);
        return { error: new Error('Errore nella creazione dell\'azienda: ' + (companyError?.message || 'Unknown error')) };
      }

      // 2. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.adminName,
            company_id: newCompanyId,
          },
          emailRedirectTo: undefined, // Skip email confirmation for now
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        // Try to cleanup the company
        await supabase.from('companies').delete().eq('id', newCompanyId);
        return { error: new Error('Errore nella creazione dell\'utente: ' + authError.message) };
      }

      if (!authData.user) {
        await supabase.from('companies').delete().eq('id', newCompanyId);
        return { error: new Error('Errore: utente non creato') };
      }

      const userId = authData.user.id;

      // 3. Complete user registration (users table, company_users, settings)
      const { data: registrationSuccess, error: registrationError } = await supabase
        .rpc('complete_user_registration', {
          p_user_id: userId,
          p_email: data.email,
          p_full_name: data.adminName,
          p_company_id: newCompanyId,
        });

      if (registrationError || !registrationSuccess) {
        console.error('Error completing user registration:', registrationError);
        return { error: new Error('Errore nel completamento della registrazione: ' + (registrationError?.message || 'Unknown error')) };
      }

      // Success! Email is already confirmed by server-side user creation
      // The auth state change will handle the redirect
      return { error: null };
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Signing out user...');

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear company ID
      setCompanyId(null);

      // Clear local storage completely
      localStorage.clear();

      // Clear session storage
      sessionStorage.clear();

      console.log('✅ Sign out successful, reloading page...');

      // Force page reload to clear all state
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      // Even if there's an error, clear everything and reload
      localStorage.clear();
      sessionStorage.clear();
      setCompanyId(null);
      window.location.href = '/';
    }
  };

  const value: AuthContextType = {
    user,
    session,
    companyId,
    loading,
    loginError,
    clearLoginError,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
