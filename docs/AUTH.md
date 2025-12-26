# Authentication & Authorization

This document describes the authentication architecture for XOVR Service Pro.

## Overview

- **Provider**: Supabase Auth with Google OAuth
- **Roles**: `ADMIN` | `TECHNICIAN` (stored in `app_metadata.role`)
- **Default Role**: `TECHNICIAN` (when `app_metadata.role` is not set)

## Architecture

```
src/auth/
├── index.ts           # Re-exports all auth modules
├── types.ts           # TypeScript interfaces
├── utils.ts           # Role extraction, env validation
├── AuthContext.tsx    # React Context + Provider
├── useAuth.ts         # Main auth hook
├── LoginPage.tsx      # Login UI component
└── guards/
    ├── RequireAuth.tsx    # Blocks unauthenticated users
    └── RequireAdmin.tsx   # Blocks non-admin users
```

## Usage

### Setup (index.tsx)

```tsx
import { AuthProvider } from './src/auth';

root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

### Using the Auth Hook

```tsx
import { useAuth } from './src/auth';

function MyComponent() {
  const { user, loading, error, signInWithGoogle, signOut, isAdmin } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginPage />;

  return (
    <div>
      <p>Hello, {user.name}</p>
      {isAdmin && <AdminPanel />}
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

### Using Guards

```tsx
import { RequireAuth, RequireAdmin } from './src/auth';

// Block unauthenticated users
<RequireAuth fallback={<LoginPage />}>
  <ProtectedContent />
</RequireAuth>

// Block non-admin users
<RequireAdmin>
  <AdminOnlyPanel />
</RequireAdmin>

// Silent admin guard (renders nothing if not admin)
<RequireAdmin silent>
  <AdminToolbar />
</RequireAdmin>
```

## Roles

### How Roles Work

Roles are stored in Supabase's `app_metadata.role` field:

- `app_metadata.role = "admin"` → `ADMIN`
- `app_metadata.role = undefined` → `TECHNICIAN` (default)

### Promoting a User to Admin

Use the Supabase Admin API (requires service role key):

```bash
curl -X PUT 'https://nlajjzqljmalglslwhzz.supabase.co/auth/v1/admin/users/{USER_ID}' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_metadata": {"role": "admin"}}'
```

Or via the Supabase Dashboard:
1. Go to Authentication → Users
2. Click on the user
3. Edit `app_metadata` to include `{"role": "admin"}`

## Environment Variables

Required in production:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key

In development, hardcoded fallbacks are used if env vars are missing.

## Debug Panel

In development mode, an Auth Debug Panel appears in the bottom-right corner. It shows:
- User ID
- Email
- Provider
- Role (from app_metadata)
- Full user_metadata and app_metadata
- Token expiration

## Admin Users Panel

The `AdminUsersPanel` component (for admin users only) provides:
- Current admin info
- Link to Supabase dashboard for user management

Note: Full user listing requires Supabase Admin API which needs the service role key. This should only be called from a backend/edge function, never from the client.

## Security Notes

1. **Never expose the service role key** in client code
2. Role checks happen client-side for UI, but critical operations should be protected by Row Level Security (RLS) in Supabase
3. The auth module validates environment variables and fails fast in production if they're missing
4. Demo/manual login modes have been removed for production safety
