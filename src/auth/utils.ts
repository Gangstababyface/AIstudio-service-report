// Auth utility functions
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserRole, AuthUser } from './types';

/**
 * Extract user role from Supabase app_metadata.
 * Defaults to TECHNICIAN if not set.
 */
export function getUserRole(user: SupabaseUser): UserRole {
  const appRole = user.app_metadata?.role;
  if (appRole === 'admin' || appRole === 'ADMIN') {
    return 'ADMIN';
  }
  return 'TECHNICIAN';
}

/**
 * Transform Supabase user to our AuthUser type.
 */
export function mapSupabaseUser(user: SupabaseUser): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    role: getUserRole(user),
  };
}

/**
 * Validate required environment variables.
 * Throws if critical vars are missing in production.
 */
export function validateEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // In development, use fallbacks (already in supabase.ts)
  if (!url || !anonKey) {
    if (import.meta.env.PROD) {
      throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }
    console.warn(
      '[Auth] Missing env vars in dev mode. Using hardcoded fallbacks.'
    );
  }

  return {
    url: url || 'https://nlajjzqljmalglslwhzz.supabase.co',
    anonKey: anonKey || 'sb_publishable_SP2W3cxu9BUl17Ivd1M_9Q_arUdih1A',
  };
}
