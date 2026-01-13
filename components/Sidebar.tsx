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
    <div className="w-20 lg:w-64 flex-shrink-0 bg-white m-4 rounded-xl flex flex-col justify-between border border-slate-200 shadow-card h-[calc(100vh-2rem)] transition-all duration-300">
      <div>
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
            N
          </div>
          <span className="hidden lg:block ml-3 font-bold text-lg text-slate-900 tracking-tight">{APP_NAME}</span>
        </div>

        <nav className="mt-2 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-center lg:justify-start px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={19} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
                <span className={`hidden lg:block ml-3 font-medium text-sm ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-slate-100">
        <button className="w-full flex items-center justify-center lg:justify-start px-3 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150">
          <LogOut size={19} />
          <span className="hidden lg:block ml-3 font-medium text-sm">Esci</span>
        </button>
      </div>
    </div>
  );
};
