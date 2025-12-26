// Auth utility functions
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserRole, AuthUser } from './types';
import { supabase } from '../lib/supabase';

/**
 * Fetch user data from public.users table.
 * This is the source of truth for role.
 */
export async function fetchUserFromDB(userId: string): Promise<{ name: string; role: UserRole } | null> {
  const { data, error } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    name: data.name,
    role: data.role === 'admin' ? 'ADMIN' : 'TECHNICIAN',
  };
}

/**
 * Transform Supabase user to our AuthUser type.
 * Fetches role from public.users table.
 */
export async function mapSupabaseUserAsync(user: SupabaseUser): Promise<AuthUser> {
  // Fetch from DB for authoritative role
  const dbUser = await fetchUserFromDB(user.id);

  return {
    id: user.id,
    email: user.email || '',
    name: dbUser?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    role: dbUser?.role || 'TECHNICIAN',
  };
}

/**
 * Sync version for initial render (uses app_metadata as fallback).
 * @deprecated Use mapSupabaseUserAsync for accurate role
 */
export function mapSupabaseUser(user: SupabaseUser): AuthUser {
  const appRole = user.app_metadata?.role;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    role: appRole === 'admin' || appRole === 'ADMIN' ? 'ADMIN' : 'TECHNICIAN',
  };
}

/**
 * Validate required environment variables.
 * Throws if critical vars are missing in production.
 */
export function validateEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (import.meta.env.PROD) {
      throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }
    console.warn('[Auth] Missing env vars in dev mode. Using hardcoded fallbacks.');
  }

  return {
    url: url || 'https://nlajjzqljmalglslwhzz.supabase.co',
    anonKey: anonKey || 'sb_publishable_SP2W3cxu9BUl17Ivd1M_9Q_arUdih1A',
  };
}
