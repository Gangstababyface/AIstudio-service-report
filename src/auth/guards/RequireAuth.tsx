import React, { ReactNode } from 'react';
import { useAuth } from '../useAuth';

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Guard component that blocks unauthenticated users.
 * Shows loading spinner while checking auth, then renders fallback if not authenticated.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-red-500 text-3xl mb-4"></i>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl text-center max-w-sm w-full">
          <div className="text-4xl text-red-500 mb-4">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Authentication Required</h1>
          <p className="text-slate-400 text-sm">Please sign in to access this content.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
