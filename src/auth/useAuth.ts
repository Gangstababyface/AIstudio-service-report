import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthContextValue } from './types';

/**
 * Hook to access auth state and methods.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
