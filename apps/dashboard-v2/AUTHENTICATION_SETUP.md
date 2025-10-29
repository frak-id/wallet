# 🔒 Authentication Setup - TanStack Start

**Date**: October 29, 2025
**Status**: Basic authentication implemented ✅

## Architecture

### TanStack Start Native Session Management

Instead of using `iron-session` or `vinxi/http`, we're using **TanStack Start's built-in session management**, which provides:

- ✅ Encrypted session cookies
- ✅ Type-safe session data
- ✅ Server-side session handling
- ✅ No Vinxi dependencies

## Implementation

### 1. Session Configuration

```ts
// src/context/auth/session.ts
export const sessionConfig = {
    password: process.env.SESSION_ENCRYPTION_KEY,
    name: "businessSession",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    cookie: {
        secure: !isRunningLocally,
        sameSite: "lax",
        httpOnly: true,
    },
};
```

### 2. Server Functions

**Using TanStack Start's `createServerFn`**:

```ts
// Get session
export const getSession = createServerFn({ method: "GET" }).handler(
    async (): Promise<AuthSessionClient | null> => {
        const session = await getStartSession<AuthSession>(sessionConfig);
        if (!session.data.wallet) return null;
        return { wallet: session.data.wallet };
    }
);

// Logout
export const logout = createServerFn({ method: "POST" }).handler(
    async () => {
        await clearSession(sessionConfig);
    }
);
```

### 3. Route Protection

**Using TanStack Router's `beforeLoad` hook**:

```tsx
// Protected route example (dashboard.tsx)
export const Route = createFileRoute("/dashboard")({
    beforeLoad: requireAuth,  // ← Checks auth, redirects if not logged in
    component: Dashboard,
});
```

**Auth helper** (`src/middleware/auth.ts`):

```ts
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        throw redirect({
            to: "/login",
            search: { redirect: window.location.pathname },
        });
    }
    return { session };
}

export async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) {
        throw redirect({ to: "/dashboard" });
    }
}
```

### 4. Route Flow

**Root route (`/`)**:
- Checks if authenticated
- Redirects to `/dashboard` if logged in
- Redirects to `/login` if not logged in

**Login route (`/login`)**:
- Uses `redirectIfAuthenticated`
- Redirects to `/dashboard` if already logged in
- Shows login form if not authenticated

**Protected routes** (`/dashboard`, `/settings`, etc.):
- Uses `requireAuth`
- Redirects to `/login` if not authenticated
- Shows content if authenticated

## File Structure

```
src/
├── context/
│   └── auth/
│       └── session.ts           # Session management (TanStack Start)
├── middleware/
│   └── auth.ts                  # Auth helpers (requireAuth, etc.)
├── routes/
│   ├── index.tsx               # Root redirect
│   ├── login.tsx               # Login page (public)
│   ├── dashboard.tsx           # Protected route
│   └── settings.tsx            # Protected route
└── types/
    └── AuthSession.ts          # Session type definitions
```

## Key Differences from Next.js

| Next.js | TanStack Start |
|---------|----------------|
| `middleware.ts` | `beforeLoad` hook per route |
| `"use server"` | `createServerFn()` |
| `cookies()` from next/headers | `getSession()` from @tanstack/react-start/server |
| `iron-session` + cookies | TanStack Start built-in sessions |
| Middleware runs globally | Route-level protection via `beforeLoad` |

## Benefits of TanStack Start Approach

1. **No Vinxi** - Pure Vite, native session APIs
2. **Type-Safe** - Full TypeScript support for sessions
3. **Route-Level** - Fine-grained control per route
4. **Built-in** - No external session libraries needed
5. **Encrypted** - Cookies automatically encrypted
6. **Flexible** - Can add middleware later for global auth checks

## APIs Used

**From `@tanstack/react-start/server`**:
- `getSession<T>(config)` - Get current session
- `updateSession<T>(config, data)` - Update session
- `clearSession(config)` - Clear session
- `getRequestHost()` - Get request hostname
- `getCookie(name)` / `setCookie()` - Cookie utilities

**From `@tanstack/react-start`**:
- `createServerFn({ method })` - Create server function
- `.handler(async () => {})` - Define server logic

**From `@tanstack/react-router`**:
- `redirect({ to, search })` - Programmatic navigation
- `beforeLoad` - Route lifecycle hook

## Next Steps

### To Complete Authentication:

1. **Add Login Component** - Wallet connection UI
2. **Implement SIWE** - Sign-in with Ethereum
3. **Add setSession** - Save authenticated wallet
4. **Session Validation** - Verify SIWE message expiration
5. **Logout Button** - Call `logout()` server function

### To Add:

```ts
// In session.ts
export const setSession = createServerFn({ method: "POST" })
    .validator((data: { message: string; signature: Hex }) => data)
    .handler(async (ctx) => {
        // 1. Parse SIWE message
        // 2. Validate signature
        // 3. Update session
        await updateSession(sessionConfig, {
            wallet: address,
            siwe: { message, signature },
        });
    });
```

## Status

✅ **Session Management**: Using TanStack Start built-in
✅ **Route Protection**: `beforeLoad` hooks working
✅ **Server Functions**: `getSession()`, `logout()` implemented
✅ **TypeScript**: All checks passing
⏳ **SIWE Integration**: To be added
⏳ **Login UI**: To be added

## References

- [TanStack Start Middleware Docs](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [TanStack Router beforeLoad](https://tanstack.com/router/latest/docs/framework/react/guide/beforeLoad)
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)

---

**Authentication foundation complete!** Ready to add login UI and SIWE integration. 🔐

