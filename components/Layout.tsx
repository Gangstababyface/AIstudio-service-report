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
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="text-xl font-bold text-brand-600 flex items-center gap-2">
            <i className="fa-solid fa-screwdriver-wrench"></i>
            <span className="hidden sm:inline">XOVR Tools</span>
          </div>
          {title && (
            <>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-medium text-gray-800 truncate max-w-[200px] sm:max-w-md">{title}</h1>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {actions}
          {user && (
            <div className="flex items-center space-x-2 pl-3 border-l border-gray-200">
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">{user.role}</div>
              </div>
              <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}`} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
