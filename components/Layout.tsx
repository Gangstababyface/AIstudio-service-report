
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
    <div className="flex flex-col h-full bg-slate-100">
      {/* Dark Industrial Header */}
      <header className="bg-[#111827] border-b border-black h-16 flex items-center justify-between sticky top-0 z-50 shadow-lg shrink-0">
        <div className="flex items-center h-full">
          {/* Logo Area - White Box */}
          <div className="h-full bg-white px-4 flex items-center justify-center border-r border-slate-200">
             <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6942d9eb36db1e00f69ccffb/ffd8b423f_xovr-logo.png" alt="XOVR" className="h-14 w-auto object-contain" />
          </div>
          
          {/* Title Area */}
          <div className="flex items-center px-8 h-full border-r border-slate-800 bg-slate-900/50">
             <h1 className="text-sm font-black text-white tracking-[0.2em] uppercase">{title || 'DASHBOARD'}</h1>
          </div>
        </div>
        
        <div className="flex items-center pr-6 space-x-6">
          {actions}
          
          {user && (
            <div className="flex items-center gap-4 pl-6 border-l border-slate-700 h-8">
              <div className="text-right hidden md:block leading-tight">
                <div className="text-xs font-bold text-slate-200">{user.name}</div>
                <div className="text-[10px] text-brand-500 font-bold tracking-wider">{user.role}</div>
              </div>
              <div className="relative group cursor-pointer">
                  <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=dc2626&color=fff`} alt="Profile" className="w-9 h-9 rounded bg-slate-800 border border-slate-600 object-cover" />
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#111827] rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-4 sm:p-8 relative">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};
