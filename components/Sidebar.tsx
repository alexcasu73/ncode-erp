import React from 'react';
import { NavItem } from '../types';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  return (
    <div className="w-64 lg:w-64 flex-shrink-0 bg-white m-0 lg:m-4 rounded-none lg:rounded-3xl flex flex-col justify-between border-r lg:border border-gray-200 shadow-none lg:shadow-sm h-screen lg:h-[calc(100vh-2rem)] transition-all duration-300">
      <div>
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-dark font-bold text-xl">
            N
          </div>
          <span className="hidden lg:block ml-3 font-bold text-xl text-dark tracking-tight">{APP_NAME}</span>
        </div>

        <nav className="mt-4 px-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-full transition-all duration-200 group ${
                  isActive
                    ? 'bg-dark text-white shadow-lg shadow-gray-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-dark'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-primary' : 'text-gray-500 group-hover:text-dark'} />
                <span className={`hidden lg:block ml-3 font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4">
        <button className="w-full flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          <span className="hidden lg:block ml-3 font-medium">Esci</span>
        </button>
      </div>
    </div>
  );
};
