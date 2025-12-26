
import React from 'react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user?: User;
  onLogout?: () => void;
  title?: string;
  actions?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, title, actions }) => {
  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Dark Industrial Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800 h-16 flex items-center justify-between sticky top-0 z-50 shadow-xl shrink-0">
        <div className="flex items-center h-full gap-4">
          {/* Logo - stretched corner to corner */}
          <div className="h-full bg-white flex items-center px-4">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6942d9eb36db1e00f69ccffb/ffd8b423f_xovr-logo.png" alt="XOVR" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-sm font-bold text-white tracking-wide">{title || 'Service Report Pro'}</h1>
        </div>

        <div className="flex items-center pr-6 space-x-6">
          {actions}

          {user && (
            <div className="flex items-center gap-4 pl-6 border-l border-slate-700 h-8">
              <div className="text-right hidden md:block leading-tight">
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-[10px] text-red-500 font-bold tracking-wider uppercase">{user.role}</div>
              </div>
              <div className="relative group cursor-pointer">
                  <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=dc2626&color=fff`} alt="Profile" className="w-10 h-10 rounded-lg bg-slate-800 border-2 border-slate-600 object-cover" />
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 relative bg-slate-950">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};
