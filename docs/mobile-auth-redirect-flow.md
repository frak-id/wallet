# Mobile Authentication Redirect Flow

**Status:** Proposal  
**Created:** January 2026  
**Branch:** `feat/tauri-deep-linking`

## Overview

This document describes the implementation plan for a mobile authentication flow that:
- Opens the Frak Wallet native app (if installed) or falls back to web
- Authenticates the user via WebAuthn
- Redirects back to the partner site with an auth code
- SDK exchanges the code for a session

This enables seamless mobile authentication without requiring popup windows, which are unreliable on mobile browsers.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PARTNER WEBSITE                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SDK IFRAME (Listener)                        │    │
│  │                                                                      │    │
│  │   User clicks "Login"                                                │    │
│  │         │                                                            │    │
│  │         ▼                                                            │    │
│  │   ┌─────────────┐                                                    │    │
│  │   │ isMobile()? │                                                    │    │
│  │   └──────┬──────┘                                                    │    │
│  │          │                                                           │    │
│  │    ┌─────┴─────┐                                                     │    │
│  │    │           │                                                     │    │
│  │   Yes          No                                                    │    │
│  │    │           │                                                     │    │
│  │    ▼           ▼                                                     │    │
│  │  Universal   Popup SSO                                               │    │
│  │  Link Flow   (existing)                                              │    │
│  │    │                                                                 │    │
│  └────┼─────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
└───────┼──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Universal Link:                      │
│  https://wallet.frak.id/open/login    │
│  ?returnUrl=https://partner.com       │
│  &productId=0x123...                  │
│  &state=abc123                        │
└───────────────────┬───────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
    App Installed       App NOT Installed
          │                   │
          ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│  NATIVE APP     │  │  WEB WALLET     │
│  (Tauri)        │  │  (Safari/Chrome)│
├─────────────────┤  ├─────────────────┤
│ 1. Parse params │  │ 1. Parse params │
│ 2. Show login   │  │ 2. Show login   │
│ 3. WebAuthn     │  │ 3. WebAuthn     │
│ 4. Get authCode │  │ 4. Get authCode │
│ 5. Open browser │  │ 5. Redirect     │
│    with code    │  │    with code    │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └─────────┬──────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PARTNER WEBSITE                                   │
│                                                                              │
│  URL: https://partner.com?frakAuth=eyJ...&state=abc123                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                              SDK                                     │    │
│  │                                                                      │    │
│  │   1. Detect frakAuth query param                                    │    │
│  │   2. Validate state matches                                         │    │
│  │   3. Exchange authCode with backend                                 │    │
│  │   4. Store session                                                  │    │
│  │   5. Clean URL (remove params)                                      │    │
│  │   6. Notify iframe of session                                       │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ✅ User is now logged in                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Model

### Auth Code Properties
| Property | Value | Rationale |
|----------|-------|-----------|
| Format | Signed JWT | Tamper-proof, self-contained |
| Expiry | 60 seconds | Minimize replay window |
| Usage | One-time | Prevent replay attacks |
| Binding | `productId` + `returnUrl` origin | Prevent code theft across sites |

### Auth Code Payload (JWT)
```typescript
interface AuthCodePayload {
    // Standard JWT claims
    iss: "frak-wallet";
    sub: string;              // Wallet address
    aud: string;              // productId
    exp: number;              // Expiry timestamp (now + 60s)
    iat: number;              // Issued at
    jti: string;              // Unique code ID (for one-time use tracking)
    
    // Custom claims
    origin: string;           // Allowed returnUrl origin
    sessionId: string;        // Reference to full session data
}
```

### State Parameter
- Generated by SDK before redirect
- Stored in sessionStorage
- Validated on return to prevent CSRF

## Implementation Components

### 1. Backend: Auth Code Endpoints

**Location:** `services/backend/src/domain/auth/`

#### 1.1 Generate Auth Code
```
POST /wallet/auth/mobile/code
```

**Request:**
```typescript
{
    productId: Hex;
    returnOrigin: string;     // Origin of partner site
    walletAddress: Address;   // Authenticated user's address
}
```

**Response:**
```typescript
{
    authCode: string;         // Signed JWT
    expiresAt: number;        // Unix timestamp
}
```

**Logic:**
- Validate user is authenticated (WebAuthn session)
- Validate `returnOrigin` is allowed for `productId`
- Generate JWT with claims
- Store `jti` in Redis with 60s TTL (for one-time use check)
- Return signed code

#### 1.2 Exchange Auth Code
```
POST /wallet/auth/mobile/exchange
```

**Request:**
```typescript
{
    authCode: string;
    productId: Hex;
}
```

**Response:**
```typescript
{
    wallet: Address;
    session: SessionData;     // Full session info
}
```

**Logic:**
- Verify JWT signature
- Validate `exp` not passed
- Validate `aud` matches `productId`
- Check `jti` exists in Redis (not yet used)
- Delete `jti` from Redis (mark as used)
- Return session data

### 2. Wallet App: Login Route

**Location:** `apps/wallet/app/routes/open/login.tsx`

#### 2.1 Route Handler
```typescript
// apps/wallet/app/routes/open/login.tsx
import { createFileRoute, useSearch } from "@tanstack/react-router";

type LoginSearchParams = {
    returnUrl?: string;
    productId?: string;
    state?: string;
};

export const Route = createFileRoute("/open/login")({
    validateSearch: (search): LoginSearchParams => ({
        returnUrl: search.returnUrl as string | undefined,
        productId: search.productId as string | undefined,
        state: search.state as string | undefined,
    }),
    component: OpenLoginPage,
});

function OpenLoginPage() {
    const { returnUrl, productId, state } = useSearch({ from: "/open/login" });
    
    // - Validate returnUrl is a valid URL
    // - Show login UI
    // - On success, generate auth code and redirect
}
```

#### 2.2 Login Flow Component
```typescript
// apps/wallet/app/module/open-login/component/OpenLoginFlow.tsx
export function OpenLoginFlow({ 
    returnUrl, 
    productId, 
    state 
}: OpenLoginFlowProps) {
    const { login, isSuccess, session } = useLogin();
    
    useEffect(() => {
        if (isSuccess && session) {
            handleLoginSuccess(session, returnUrl, productId, state);
        }
    }, [isSuccess, session]);
    
    async function handleLoginSuccess(
        session: Session,
        returnUrl: string,
        productId: string,
        state: string
    ) {
        // Call backend to generate auth code
        const { authCode } = await generateAuthCode({
            productId,
            returnOrigin: new URL(returnUrl).origin,
            walletAddress: session.address,
        });
        
        // Build redirect URL
        const redirectUrl = new URL(returnUrl);
        redirectUrl.searchParams.set("frakAuth", authCode);
        redirectUrl.searchParams.set("state", state);
        
        // Redirect (or open browser on native)
        if (isTauriApp()) {
            // Tauri: open in default browser
            await open(redirectUrl.toString());
        } else {
            // Web: direct redirect
            window.location.href = redirectUrl.toString();
        }
    }
    
    return <LoginUI onLogin={login} />;
}
```

### 3. Tauri App: Deep Link Handler

**Location:** `apps/wallet/src-tauri/src/lib.rs` + `apps/wallet/app/utils/deepLink.ts`

#### 3.1 Update Deep Link Handler
```typescript
// apps/wallet/app/utils/deepLink.ts
export function handleDeepLink(url: string) {
    const parsed = new URL(url);
    
    // Handle /open/login path
    if (parsed.pathname === "/open/login") {
        const returnUrl = parsed.searchParams.get("returnUrl");
        const productId = parsed.searchParams.get("productId");
        const state = parsed.searchParams.get("state");
        
        // Navigate to login route with params
        router.navigate({
            to: "/open/login",
            search: { returnUrl, productId, state },
        });
    }
}
```

### 4. SDK: Auth Callback Detection

**Location:** `sdk/core/src/utils/authCallback.ts`

#### 4.1 New Utility
```typescript
// sdk/core/src/utils/authCallback.ts
import type { FrakClient } from "../types";

export interface AuthCallbackResult {
    success: boolean;
    wallet?: Address;
    error?: string;
}

/**
 * Check for and process mobile auth callback
 * Should be called during SDK initialization
 */
export async function processAuthCallback(
    client: FrakClient
): Promise<AuthCallbackResult | null> {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("frakAuth");
    const state = params.get("state");
    
    // No callback params present
    if (!authCode) {
        return null;
    }
    
    // Validate state
    const savedState = sessionStorage.getItem("frak_auth_state");
    if (state !== savedState) {
        console.error("[Frak SDK] Auth callback state mismatch");
        cleanupAuthParams();
        return { success: false, error: "state_mismatch" };
    }
    
    try {
        // Exchange code for session
        const result = await exchangeAuthCode(client, authCode);
        
        // Clean up
        sessionStorage.removeItem("frak_auth_state");
        cleanupAuthParams();
        
        return { success: true, wallet: result.wallet };
    } catch (error) {
        cleanupAuthParams();
        return { success: false, error: String(error) };
    }
}

/**
 * Remove auth params from URL without page reload
 */
function cleanupAuthParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("frakAuth");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
}

/**
 * Exchange auth code with backend
 */
async function exchangeAuthCode(
    client: FrakClient,
    authCode: string
): Promise<{ wallet: Address }> {
    const response = await fetch(
        `${client.config.walletUrl}/api/wallet/auth/mobile/exchange`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                authCode,
                productId: client.config.productId,
            }),
        }
    );
    
    if (!response.ok) {
        throw new Error(`Exchange failed: ${response.status}`);
    }
    
    return response.json();
}
```

#### 4.2 Integrate into SDK Init
```typescript
// sdk/core/src/clients/setupClient.ts (or initFrakSdk)
import { processAuthCallback } from "../utils/authCallback";

export async function setupClient(config: FrakConfig): Promise<FrakClient> {
    // ... existing setup ...
    
    // Check for mobile auth callback
    const authResult = await processAuthCallback(client);
    if (authResult?.success) {
        // Notify listeners of successful auth
        client.emit("authenticated", { wallet: authResult.wallet });
    }
    
    // ... rest of setup ...
}
```

#### 4.3 Export from SDK
```typescript
// sdk/core/src/index.ts
export { processAuthCallback } from "./utils/authCallback";
export type { AuthCallbackResult } from "./utils/authCallback";
```

### 5. Listener: Mobile Login Redirect

**Location:** `apps/listener/app/module/component/SsoButton.tsx`

#### 5.1 Update SsoButton
```typescript
// apps/listener/app/module/component/SsoButton.tsx
import { isMobile } from "@frak-labs/wallet-shared";
import { generateState, buildMobileLoginUrl } from "@/module/utils/mobileAuth";

export function SsoButton({
    productId,
    ssoMetadata,
    text,
    className,
}: SsoButtonProps) {
    const {
        currentRequest: { appName },
        translation: { lang },
    } = useListenerWithRequestUI();
    
    // Existing SSO link for desktop
    const { link } = useSsoLink({ ... });
    
    // Get wallet URL from config
    const walletUrl = window.FrakSetup?.config?.walletUrl ?? "https://wallet.frak.id";
    
    const handleClick = () => {
        if (isMobile()) {
            // Mobile: Use redirect flow
            const state = generateState();
            sessionStorage.setItem("frak_auth_state", state);
            
            const loginUrl = buildMobileLoginUrl({
                walletUrl,
                returnUrl: window.location.href,
                productId,
                state,
            });
            
            // Redirect to Universal Link
            window.location.href = loginUrl;
        } else {
            // Desktop: Use popup SSO (existing flow)
            const openedWindow = window.open(link, ssoPopupName, ssoPopupFeatures);
            if (openedWindow) {
                openedWindow.focus();
                trackAuthInitiated("sso");
            }
        }
    };
    
    if (!link && !isMobile()) {
        return null;
    }
    
    return (
        <button type="button" className={className} onClick={handleClick}>
            {text}
        </button>
    );
}
```

#### 5.2 Mobile Auth Utilities
```typescript
// apps/listener/app/module/utils/mobileAuth.ts

/**
 * Generate cryptographically secure state parameter
 */
export function generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build Universal Link URL for mobile login
 */
export function buildMobileLoginUrl({
    walletUrl,
    returnUrl,
    productId,
    state,
}: {
    walletUrl: string;
    returnUrl: string;
    productId: string;
    state: string;
}): string {
    const url = new URL("/open/login", walletUrl);
    url.searchParams.set("returnUrl", returnUrl);
    url.searchParams.set("productId", productId);
    url.searchParams.set("state", state);
    return url.toString();
}
```

### 6. Shared: Mobile Detection

**Location:** `packages/wallet-shared/src/common/utils/isMobile.ts`

```typescript
// packages/wallet-shared/src/common/utils/isMobile.ts
/**
 * Check if the current device is a mobile device
 * Uses lightweight regex check on userAgent
 */
export function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}
```

Export from package:
```typescript
// packages/wallet-shared/src/index.ts
export { isMobile } from "./common/utils/isMobile";
```

## File Changes Summary

| Component | File | Action |
|-----------|------|--------|
| **Backend** | `services/backend/src/domain/auth/api/mobileAuth.ts` | Create |
| **Backend** | `services/backend/src/domain/auth/services/mobileAuthService.ts` | Create |
| **Backend** | `services/backend/src/api/wallet/index.ts` | Update (add routes) |
| **Wallet** | `apps/wallet/app/routes/open/login.tsx` | Create |
| **Wallet** | `apps/wallet/app/module/open-login/` | Create (new module) |
| **Wallet** | `apps/wallet/app/utils/deepLink.ts` | Update |
| **Tauri** | `apps/wallet/src-tauri/tauri.conf.json` | Verify deep link config |
| **SDK Core** | `sdk/core/src/utils/authCallback.ts` | Create |
| **SDK Core** | `sdk/core/src/clients/setupClient.ts` | Update |
| **SDK Core** | `sdk/core/src/index.ts` | Update (export) |
| **Listener** | `apps/listener/app/module/component/SsoButton.tsx` | Update |
| **Listener** | `apps/listener/app/module/utils/mobileAuth.ts` | Create |
| **Shared** | `packages/wallet-shared/src/common/utils/isMobile.ts` | Create |
| **Shared** | `packages/wallet-shared/src/index.ts` | Update (export) |

## Implementation Order

### Phase 1: Foundation (Backend + Shared)
**Status:** ✅ Completed  
**Completed:** January 8, 2026

- [x] Create `isMobile` utility in `wallet-shared` (already exists as `ua.isMobile`)
- [x] Create backend auth code endpoints (`POST /wallet/auth/mobile/code`, `POST /wallet/auth/mobile/exchange`)
- [x] Add tests for auth code generation/validation (8 tests passing)

### Phase 2: Wallet App
**Status:** ⏳ Not Started  
**Completed:** -

- [ ] Create `/open/login` route
- [ ] Create `OpenLoginFlow` component
- [ ] Update deep link handler for Tauri
- [ ] Test on iOS simulator

### Phase 3: SDK Integration
**Status:** ⏳ Not Started  
**Completed:** -

- [ ] Create `authCallback` utility in core SDK
- [ ] Integrate into SDK initialization
- [ ] Add tests for callback detection

### Phase 4: Listener Update
**Status:** ⏳ Not Started  
**Completed:** -

- [ ] Update `SsoButton` with mobile detection
- [ ] Create mobile auth utilities (`generateState`, `buildMobileLoginUrl`)
- [ ] Test full flow

### Phase 5: Testing & Polish
**Status:** ⏳ Not Started  
**Completed:** -

- [ ] E2E test: Mobile Safari → Web Wallet → Redirect
- [ ] E2E test: Mobile Safari → Native App → Redirect
- [ ] E2E test: State mismatch handling
- [ ] E2E test: Expired code handling

## Testing Strategy

### Unit Tests
- Auth code generation (valid JWT, correct claims)
- Auth code validation (signature, expiry, one-time use)
- State generation (randomness)
- URL building (correct params)
- Callback detection (param extraction)

### Integration Tests
- Backend: `POST /code` → `POST /exchange` flow
- SDK: Full callback processing
- Listener: Mobile detection + redirect

### E2E Tests (Playwright)
```typescript
// tests/specs/mobile-auth.spec.ts
test.describe("Mobile Authentication Flow", () => {
    test("should redirect to wallet and back with auth code", async ({ page }) => {
        // - Mock mobile user agent
        // - Click login on partner site
        // - Verify redirect to wallet.frak.id/open/login
        // - Complete login
        // - Verify redirect back with frakAuth param
        // - Verify session established
        // - Verify URL cleaned up
    });
    
    test("should reject invalid state parameter", async ({ page }) => {
        // Simulate CSRF attack with wrong state
    });
    
    test("should reject expired auth code", async ({ page }) => {
        // Wait > 60s and try to exchange
    });
});
```

### Manual Testing Checklist
- [ ] iOS Safari → Web Wallet → Redirect back
- [ ] iOS Safari → Native App (installed) → Redirect back
- [ ] Android Chrome → Web Wallet → Redirect back
- [ ] Android Chrome → Native App (installed) → Redirect back
- [ ] Desktop browser still uses popup SSO
- [ ] Invalid state rejected
- [ ] Expired code rejected
- [ ] Used code rejected (replay attack)

## Rollout Plan

### Stage 1: Internal Testing
**Status:** ⏳ Not Started

- [ ] Deploy to `wallet-dev.frak.id`
- [ ] Test with internal partner sites
- [ ] Monitor for errors

### Stage 2: Beta Partners
**Status:** ⏳ Not Started

- [ ] Enable for select partners
- [ ] Feature flag: `MOBILE_AUTH_REDIRECT_ENABLED`
- [ ] Gather feedback

### Stage 3: General Availability
**Status:** ⏳ Not Started

- [ ] Enable for all partners
- [ ] Remove feature flag
- [ ] Update documentation

## Open Questions

- **Session sharing between native app and web**: If user logs in via native app, should the web wallet also be logged in? (Shared cookies won't work across app/web boundary)
- **App not installed UX**: Should we show a prompt "Open in App / Continue in Browser" or automatically try Universal Link?
- **Return URL validation**: How strictly should we validate returnUrl? Only pre-registered domains per productId?
- **Token refresh**: How does the session refresh work after redirect? Should the auth code include a refresh token?

## References

- [Apple Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Android App Links](https://developer.android.com/training/app-links)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
- [PKCE for Mobile Apps](https://oauth.net/2/pkce/)
