
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
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800 sticky top-0 z-50 shadow-xl shrink-0">
        <div className="flex items-center h-14 px-4 gap-6">
          {/* Brand: Icon + Text */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <i className="fa-solid fa-screwdriver-wrench text-red-500 text-[28px]"></i>
            <span className="text-white font-semibold text-base whitespace-nowrap">XOVR Service Pro</span>
          </div>

          {/* Page Title */}
          <h1 className="text-lg font-bold text-slate-300">{title || 'Dashboard'}</h1>

          {/* Spacer - pushes everything after this to the right */}
          <div className="flex-1" />

          {/* Actions (New Report button) */}
          {actions}

          {/* User Profile - far right */}
          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
              <div className="text-right hidden md:block leading-tight">
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-[10px] text-red-500 font-bold tracking-wider uppercase">{user.role}</div>
              </div>
              <div className="relative group cursor-pointer flex-shrink-0">
                <img
                  src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=dc2626&color=fff`}
                  alt="Profile"
                  className="w-9 h-9 rounded-lg bg-slate-800 border-2 border-slate-600 object-cover"
                />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-slate-800"
                  title="Sign out"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              )}
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
