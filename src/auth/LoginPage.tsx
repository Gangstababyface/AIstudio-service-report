import React from 'react';
import { useAuth } from './useAuth';

/**
 * Login page component for unauthenticated users.
 * Only shows Google OAuth - no demo or manual login options.
 */
export function LoginPage() {
  const { signInWithGoogle, error } = useAuth();

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl text-center max-w-sm w-full transition-all">
        <div className="text-4xl text-red-500 mb-4">
          <i className="fa-solid fa-screwdriver-wrench"></i>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">XOVR Service Pro</h1>
        <p className="text-slate-400 mb-6">Sign in to generate technician profile</p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error.message}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="w-full bg-white text-gray-700 font-medium py-2.5 px-4 rounded-lg shadow-sm hover:bg-gray-100 flex items-center justify-center gap-3 transition-colors border border-gray-300"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-slate-500 text-xs mt-6">
          Access restricted to authorized XOVR personnel.
        </p>
      </div>
    </div>
  );
}
