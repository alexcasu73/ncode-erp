import React, { useState, useEffect } from 'react';
import { NavItem } from '../types';
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEMS, APP_NAME } from '../constants';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const { user, companyId, signOut } = useAuth();
  const { canManageUsers, canImport, canReconcile, loading: roleLoading } = useUserRole();
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');

  useEffect(() => {
    loadCompanyData();
    loadUserData();

    // Listen for avatar updates
    const handleAvatarUpdate = (event: any) => {
      setUserAvatar(event.detail.url);
    };

    // Listen for company logo updates
    const handleLogoUpdate = (event: any) => {
      setCompanyLogo(event.detail.url);
    };

    window.addEventListener('avatar-updated', handleAvatarUpdate);
    window.addEventListener('company-logo-updated', handleLogoUpdate);

    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
      window.removeEventListener('company-logo-updated', handleLogoUpdate);
    };
  }, [companyId, user]);

  const loadCompanyData = async () => {
    if (!companyId) return;

    const { data } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('id', companyId)
      .single();

    if (data?.logo_url) {
      setCompanyLogo(data.logo_url);
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (data) {
      setUserName(data.full_name || '');
      setUserAvatar(data.avatar_url || '');
    }
  };

  return (
    <div className="w-64 lg:w-64 flex-shrink-0 bg-white dark:bg-dark-card m-0 lg:m-4 rounded-none lg:rounded-xl flex flex-col border-r lg:border border-gray-200 dark:border-dark-border shadow-none lg:shadow-sm h-screen lg:h-[calc(100vh-2rem)] transition-all duration-300">
      <div className="flex-shrink-0">
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-8">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt="Company Logo"
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
          )}
          <span className="hidden lg:block ml-3 font-bold text-xl text-dark dark:text-white tracking-tight">{APP_NAME}</span>
        </div>

      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto">
        <nav className="mt-4 px-4 space-y-2 pb-4">
          {/* Main Navigation Label */}
          <div className="hidden lg:block px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Operazioni
          </div>

          {/* Main Navigation Section */}
          {MAIN_NAV_ITEMS.filter((item) => {
            // Hide Reconciliation from USER and VIEWER (only ADMIN and MANAGER can see it)
            if (item.id === 'reconciliation' && !canReconcile) return false;
            return true;
          }).map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-dark dark:bg-primary text-white shadow-lg shadow-gray-200 dark:shadow-none'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-dark dark:hover:text-white'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-dark dark:group-hover:text-white'} />
                <span className={`hidden lg:block ml-3 font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-primary dark:bg-white" />}
              </button>
            );
          })}

          {/* Divider */}
          <div className="py-3">
            <div className="border-t border-gray-200 dark:border-dark-border"></div>
          </div>

          {/* Settings Navigation Label */}
          <div className="hidden lg:block px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Gestione
          </div>

          {/* Settings Navigation Section */}
          {SETTINGS_NAV_ITEMS.filter((item) => {
            // Hide Import from USER and VIEWER (only ADMIN and MANAGER can see it)
            if (item.id === 'import' && !canImport) return false;
            // Hide Users from non-ADMIN (only ADMIN can see it)
            if (item.id === 'users' && !canManageUsers) return false;
            // Hide Settings from non-ADMIN (only ADMIN can see it)
            if (item.id === 'settings' && !canManageUsers) return false;
            return true;
          }).map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-dark dark:bg-primary text-white shadow-lg shadow-gray-200 dark:shadow-none'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-dark dark:hover:text-white'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-dark dark:group-hover:text-white'} />
                <span className={`hidden lg:block ml-3 font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-primary dark:bg-white" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Fixed Bottom Section */}
      <div className="flex-shrink-0 p-4 space-y-3 border-t border-gray-200 dark:border-dark-border">
        {/* User Profile Section */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-dark-bg">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="hidden lg:block flex-1 overflow-hidden">
            <p className="text-sm font-medium text-dark dark:text-white truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Profilo
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="hidden lg:block ml-3 font-medium">Esci</span>
        </button>
      </div>
    </div>
  );
};
