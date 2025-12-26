import React from 'react';
import { useAuth, RequireAdmin } from '../auth';

/**
 * Admin panel showing user management info.
 *
 * Note: Full user listing requires Supabase Admin API which needs
 * service role key. This should be called from a backend/edge function,
 * not directly from the client.
 *
 * For now, this shows current admin's info and links to Supabase dashboard.
 */
export function AdminUsersPanel() {
  const { user } = useAuth();

  return (
    <RequireAdmin>
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-4">
        <h3 className="font-bold text-xs uppercase tracking-wider mb-3 border-b border-slate-700 pb-2 flex items-center text-blue-400">
          <i className="fa-solid fa-users mr-2"></i>
          User Management
        </h3>

        {/* Current Admin Info */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={user?.picture || `https://ui-avatars.com/api/?name=${user?.name}&background=3b82f6&color=fff`}
              alt={user?.name}
              className="w-10 h-10 rounded-lg border border-slate-600"
            />
            <div>
              <div className="text-white text-sm font-medium">{user?.name}</div>
              <div className="text-slate-400 text-xs">{user?.email}</div>
            </div>
            <div className="ml-auto">
              <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="space-y-2">
          <a
            href="https://supabase.com/dashboard/project/nlajjzqljmalglslwhzz/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors"
          >
            <span><i className="fa-solid fa-arrow-up-right-from-square mr-1.5"></i> Supabase Users Dashboard</span>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
          </a>
        </div>

        {/* Info Note */}
        <div className="mt-4 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 text-[10px] leading-relaxed">
            <i className="fa-solid fa-info-circle mr-1"></i>
            To manage users and roles, use the Supabase dashboard.
            Set <code className="bg-slate-800 px-1 rounded">app_metadata.role = "admin"</code> to grant admin access.
          </p>
        </div>
      </div>
    </RequireAdmin>
  );
}
