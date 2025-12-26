import { createClient } from '@supabase/supabase-js';

// Environment variables with fallbacks for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nlajjzqljmalglslwhzz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SP2W3cxu9BUl17Ivd1M_9Q_arUdih1A';

// Validate in production
if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('[Supabase] Missing environment variables in production!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
