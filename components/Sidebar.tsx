import React, { useState, useEffect } from 'react';
import { NavItem } from '../types';
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEMS, APP_NAME } from '../constants';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [companyName, setCompanyName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

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
      if (event.detail.name) setCompanyName(event.detail.name);
    };

    // Listen for name updates
    const handleNameUpdate = (event: any) => {
      setUserName(event.detail.name);
    };

    window.addEventListener('avatar-updated', handleAvatarUpdate);
    window.addEventListener('company-logo-updated', handleLogoUpdate);
    window.addEventListener('name-updated', handleNameUpdate);

    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
      window.removeEventListener('company-logo-updated', handleLogoUpdate);
      window.removeEventListener('name-updated', handleNameUpdate);
    };
  }, [companyId, user]);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const loadCompanyData = async () => {
    if (!companyId) return;

    const { data } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', companyId)
      .single();

    if (data) {
      if (data.logo_url) setCompanyLogo(data.logo_url);
      if (data.name) setCompanyName(data.name);
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
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 bg-white dark:bg-dark-card m-0 lg:m-4 rounded-none lg:rounded-xl flex flex-col border-r lg:border border-gray-200 dark:border-dark-border shadow-none lg:shadow-sm h-screen lg:h-[calc(100vh-2rem)] transition-all duration-300 relative`}>
      {/* Collapse Toggle Button - Anchored to right edge */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden lg:flex absolute -right-3 top-10 z-10 w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-dark-border transition-colors shadow-md"
        title={isCollapsed ? 'Espandi menu' : 'Comprimi menu'}
      >
        {isCollapsed ? (
          <ChevronRight size={14} className="text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronLeft size={14} className="text-gray-500 dark:text-gray-400" />
        )}
      </button>

      <div className="flex-shrink-0">
        <div className={`h-24 flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-6 lg:px-8'}`}>
          <div className="flex items-center">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt="Company Logo"
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                C
              </div>
            )}
            <div className={`ml-3 flex flex-col whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-150'}`}>
              <span className="font-bold text-xl text-dark dark:text-white tracking-tight leading-tight">
                {APP_NAME}
              </span>
              {companyName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                  {companyName}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto">
        <nav className="mt-4 px-4 space-y-2 pb-4">
          {/* Main Navigation Label */}
          <div className={`px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 delay-150'}`}>
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
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'} p-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-dark dark:bg-primary text-white shadow-lg shadow-gray-200 dark:shadow-none'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-dark dark:hover:text-white'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={20} className={`flex-shrink-0 ${isActive ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-dark dark:group-hover:text-white'}`} />
                <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-150'} ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                <div className={`ml-auto w-1.5 h-1.5 rounded-full bg-primary dark:bg-white transition-opacity duration-300 ${isActive && !isCollapsed ? 'opacity-100 delay-150' : 'opacity-0 w-0'}`} />
              </button>
            );
          })}

          {/* Divider */}
          <div className="py-3">
            <div className="border-t border-gray-200 dark:border-dark-border"></div>
          </div>

          {/* Settings Navigation Label */}
          <div className={`px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 delay-150'}`}>
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
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'} p-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-dark dark:bg-primary text-white shadow-lg shadow-gray-200 dark:shadow-none'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-dark dark:hover:text-white'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={20} className={`flex-shrink-0 ${isActive ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-dark dark:group-hover:text-white'}`} />
                <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-150'} ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                <div className={`ml-auto w-1.5 h-1.5 rounded-full bg-primary dark:bg-white transition-opacity duration-300 ${isActive && !isCollapsed ? 'opacity-100 delay-150' : 'opacity-0 w-0'}`} />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Fixed Bottom Section */}
      <div className="flex-shrink-0 p-4 space-y-3 border-t border-gray-200 dark:border-dark-border">
        {/* User Profile Section */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-lg bg-gray-50 dark:bg-dark-bg`}>
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              title={isCollapsed ? userName : ''}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0"
              title={isCollapsed ? userName : ''}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className={`flex-1 overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 delay-150'}`}>
            <p className="text-sm font-medium text-dark dark:text-white truncate whitespace-nowrap">
              {userName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate whitespace-nowrap">
              Profilo
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={signOut}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'} p-3 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors`}
          title={isCollapsed ? 'Esci' : ''}
        >
          <LogOut size={20} className="flex-shrink-0" />
          <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-150'}`}>
            Esci
          </span>
        </button>
      </div>
    </div>
  );
};
