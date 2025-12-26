import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Debug panel showing raw auth state.
 * Only renders in development mode.
 */
export function AuthDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionData(session);
    };
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionData(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2"
      >
        <i className="fa-solid fa-bug"></i>
        {isOpen ? 'Hide' : 'Auth Debug'}
      </button>

      {isOpen && (
        <div className="absolute bottom-10 right-0 w-96 max-h-[60vh] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
            <span className="text-yellow-500 font-bold text-xs uppercase tracking-wider">
              <i className="fa-solid fa-shield-halved mr-2"></i>
              Auth Debug Panel
            </span>
            <span className="text-slate-500 text-[10px]">DEV ONLY</span>
          </div>

          <div className="p-3 overflow-auto max-h-[50vh]">
            {sessionData ? (
              <div className="space-y-3">
                <Section title="User ID">
                  <code className="text-green-400 text-xs break-all">{sessionData.user?.id}</code>
                </Section>

                <Section title="Email">
                  <code className="text-blue-400 text-xs">{sessionData.user?.email}</code>
                </Section>

                <Section title="Provider">
                  <code className="text-purple-400 text-xs">
                    {sessionData.user?.app_metadata?.provider || 'unknown'}
                  </code>
                </Section>

                <Section title="Role (app_metadata)">
                  <code className="text-red-400 text-xs font-bold">
                    {sessionData.user?.app_metadata?.role || 'NOT SET (defaults to TECHNICIAN)'}
                  </code>
                </Section>

                <Section title="user_metadata">
                  <pre className="text-slate-400 text-[10px] bg-slate-800 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(sessionData.user?.user_metadata, null, 2)}
                  </pre>
                </Section>

                <Section title="app_metadata">
                  <pre className="text-slate-400 text-[10px] bg-slate-800 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(sessionData.user?.app_metadata, null, 2)}
                  </pre>
                </Section>

                <Section title="Token Expires">
                  <code className="text-orange-400 text-xs">
                    {sessionData.expires_at
                      ? new Date(sessionData.expires_at * 1000).toLocaleString()
                      : 'N/A'}
                  </code>
                </Section>
              </div>
            ) : (
              <div className="text-center py-6">
                <i className="fa-solid fa-user-slash text-slate-600 text-2xl mb-2"></i>
                <p className="text-slate-500 text-xs">No active session</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">{title}</div>
      {children}
    </div>
  );
}
