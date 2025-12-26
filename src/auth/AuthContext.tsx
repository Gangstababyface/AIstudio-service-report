import React, { createContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthContextValue, AuthUser, AuthState } from './types';
import { mapSupabaseUser } from './utils';

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (session?.user) {
          setState({
            user: mapSupabaseUser(session.user),
            loading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('[Auth] Session check error:', error);
        setState({
          user: null,
          loading: false,
          error: error instanceof Error ? error : new Error('Session check failed'),
        });
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setState({
            user: mapSupabaseUser(session.user),
            loading: false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            loading: false,
            error: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Update user data on token refresh (role might have changed)
          setState((prev) => ({
            ...prev,
            user: mapSupabaseUser(session.user),
          }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('[Auth] Google sign-in error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Sign-in failed'),
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setState({
        user: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('[Auth] Sign-out error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Sign-out failed'),
      }));
    }
  }, []);

  const contextValue: AuthContextValue = {
    ...state,
    signInWithGoogle,
    signOut,
    isAdmin: state.user?.role === 'ADMIN',
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
