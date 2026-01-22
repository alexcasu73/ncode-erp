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

  // SECURITY: Periodically check if user is still active (every 30 seconds)
  // If user is disabled or deleted, automatically sign them out
  useEffect(() => {
    if (!user) return;

    const checkUserStatus = async () => {
      try {
        console.log('🔍 Checking user status...');

        const { data, error } = await supabase
          .from('company_users')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        // If user is not found or not active, sign them out
        if (error || !data) {
          console.log('🚫 User is disabled or deleted - forcing sign out');

          // Show alert to user before signing out
          alert('Il tuo account è stato disabilitato o eliminato. Verrai disconnesso.');

          // Sign out and clear everything
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();

          // Force page reload to login
          window.location.href = '/';
        } else {
          console.log('✅ User is still active');
        }
      } catch (err) {
        console.error('Error checking user status:', err);
      }
    };

    // Check immediately on mount
    checkUserStatus();

    // Then check every 30 seconds
    const intervalId = setInterval(checkUserStatus, 30000);

    return () => clearInterval(intervalId);
  }, [user]);

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
      console.log('📝 Starting registration via backend...');

      // Call backend API to handle registration
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          adminName: data.adminName,
          companyName: data.companyName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Registration error:', result);
        return { error: new Error(result.error || 'Errore durante la registrazione') };
      }

      console.log('✅ Registration successful:', result);
      console.log('📧 Confirmation email sent via Gmail API');

      return { error: null };
    } catch (err) {
      console.error('❌ Unexpected error during signup:', err);
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
