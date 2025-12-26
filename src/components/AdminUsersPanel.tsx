import React, { useState, useEffect } from 'react';
import { useAuth, RequireAdmin } from '../auth';
import { supabase } from '../lib/supabase';

interface DBUser {
  id: string;
  email: string;
  name: string;
  role: 'technician' | 'admin';
  created_at: string;
  updated_at: string;
}

/**
 * Admin panel for user management.
 * Lists all users and allows role changes.
 */
export function AdminUsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Fetch all users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminUsersPanel] Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    // Prevent changing own role
    if (userId === currentUser?.id) {
      alert("You cannot change your own role.");
      return;
    }

    const newRole = currentRole === 'admin' ? 'technician' : 'admin';
    setUpdating(userId);

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('[AdminUsersPanel] Error updating role:', error);
      alert('Failed to update role: ' + error.message);
    } else {
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setUpdating(null);
  };

  return (
    <RequireAdmin>
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
          <h3 className="font-bold text-xs uppercase tracking-wider flex items-center text-blue-400">
            <i className="fa-solid fa-users mr-2"></i>
            User Management
          </h3>
          <button
            onClick={fetchUsers}
            className="text-slate-500 hover:text-blue-400 transition-colors text-sm"
            title="Refresh"
          >
            <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        {loading ? (
          <div className="py-4 text-center text-slate-500 text-xs">
            <i className="fa-solid fa-circle-notch fa-spin mr-1"></i> Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="py-4 text-center text-slate-500 text-xs">
            No users found
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.id}
                className={`bg-slate-800/50 rounded-lg p-2.5 flex items-center gap-3 ${
                  u.id === currentUser?.id ? 'border border-blue-500/30' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="ml-1 text-blue-400 text-[10px]">(you)</span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[10px] truncate">{u.email}</div>
                </div>
                <button
                  onClick={() => toggleRole(u.id, u.role)}
                  disabled={updating === u.id || u.id === currentUser?.id}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    u.role === 'admin'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                  } ${u.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={u.id === currentUser?.id ? "Can't change own role" : `Click to make ${u.role === 'admin' ? 'technician' : 'admin'}`}
                >
                  {updating === u.id ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    u.role.toUpperCase()
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-[10px] text-slate-500">
          <span>Total: {users.length}</span>
          <span>Admins: {users.filter(u => u.role === 'admin').length}</span>
          <span>Technicians: {users.filter(u => u.role === 'technician').length}</span>
        </div>
      </div>
    </RequireAdmin>
  );
}
