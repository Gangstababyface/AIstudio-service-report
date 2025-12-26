import React, { ReactNode } from 'react';
import { useAuth } from '../useAuth';

interface RequireAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
  silent?: boolean; // If true, renders nothing instead of access denied message
}

/**
 * Guard component that blocks non-admin users.
 * Use this to wrap admin-only UI sections.
 */
export function RequireAdmin({ children, fallback, silent = false }: RequireAdminProps) {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!user || !isAdmin) {
    if (silent) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
        <div className="text-3xl text-yellow-500 mb-3">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Access Denied</h2>
        <p className="text-slate-400 text-sm">
          This section requires admin privileges.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
