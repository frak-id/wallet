# Frontend Migration Guide - Backend V2 Refactoring

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Target Audience**: Frontend Developers (Wallet App, Business Dashboard, SDK)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Breaking Changes](#breaking-changes)
3. [Route Changes](#route-changes)
4. [New Business API Routes](#new-business-api-routes)
5. [Anonymous User Flow](#anonymous-user-flow)
6. [Authentication Headers](#authentication-headers)
7. [Important Considerations](#important-considerations)
8. [Migration Checklist](#migration-checklist)

---

## Executive Summary

The backend has undergone a major refactoring from a **blockchain-centric** architecture to a **web2-first with blockchain as settlement layer** approach. This enables:

- **Anonymous user rewards** - Users can earn rewards before connecting a wallet
- **Instant attribution** - Referral tracking via database writes, not blockchain
- **Flexible campaigns** - JSON-based rule engine instead of smart contracts
- **Simpler merchant onboarding** - No blockchain interaction required

### What This Means for Frontend

1. **Wallet routes moved** from `/wallet/*` to `/user/wallet/*`
2. **New business API** for merchant/campaign management
3. **Anonymous tracking** via `x-frak-client-id` header
4. **Identity merging** when users connect wallets

---

## Breaking Changes

### Routes to Delete/Update

| Old Route | New Route | Action |
|-----------|-----------|--------|
| `/wallet/*` | `/user/wallet/*` | **UPDATE all references** |
| `/interactions/listenForPurchase` | `/user/track/purchase` | Legacy mapper exists but update |
| `/oracle/{type}/{productId}/hook` | `/ext/merchant/{merchantId}/webhook/{type}` | Legacy mapper exists |
| `/ext/products/{productId}/webhook/oracle/{type}` | `/ext/merchant/{merchantId}/webhook/{type}` | Legacy mapper exists |

### Removed Concepts

- **Product ID** (hex) → Replaced by **Merchant ID** (UUID)
- **On-chain interactions** → Replaced by database tracking
- **Merkle proofs** → Replaced by attestations
- **Interaction signing** → No longer needed

---

## Route Changes

### User API (`/user/*`)

All wallet-related routes are now under `/user/wallet/`:

```
/user
├── /track
│   ├── POST /arrival          # Track user arrival (referral click)
│   └── POST /purchase         # Claim a purchase for rewards
│
└── /wallet
    ├── /auth
    │   ├── POST /register     # WebAuthn registration
    │   ├── POST /login        # WebAuthn login
    │   ├── POST /ecdsaLogin   # ECDSA wallet login
    │   ├── POST /logout       # Clear session
    │   ├── GET  /session      # Get current session
    │   └── /sdk
    │       ├── GET  /generate              # Generate SDK JWT
    │       ├── POST /fromWebAuthNSignature # Generate JWT from signature
    │       └── GET  /isValid               # Validate SDK token
    │
    ├── /balance
    │   ├── GET  /             # Get user token balances
    │   ├── GET  /claimable    # Get claimable rewards
    │   └── GET  /pending      # Get pending rewards
    │
    ├── /pairing
    │   ├── GET  /             # List pairings
    │   ├── GET  /:id          # Get specific pairing
    │   ├── POST /             # Create pairing
    │   └── WS   /ws/:id       # WebSocket for pairing
    │
    └── /notifications
        ├── PUT    /tokens     # Register push token
        ├── DELETE /tokens     # Remove push tokens
        └── GET    /tokens     # List push tokens
```

### External API (`/ext/*`)

Webhooks for purchase tracking:

```
/ext
└── /merchant
    └── /:merchantId/webhook
        ├── POST /shopify      # Shopify order webhooks
        ├── POST /woocommerce  # WooCommerce order webhooks
        └── POST /custom       # Custom webhook format
```

---

## New Business API Routes

All business routes require `x-business-auth` header with JWT token.

### Authentication

```typescript
// Login with SIWE (Sign-In with Ethereum)
POST /business/auth/login
Body: {
    message: string,      // SIWE message
    signature: `0x${string}`
}
Response: {
    token: string,        // JWT for x-business-auth header
    wallet: `0x${string}`,
    expiresAt: number
}
```

### Merchant Management

```typescript
// Get merchants for authenticated wallet
GET /business/merchant/my
Response: {
    owned: [{ id, domain, name }],
    adminOf: [{ id, domain, name }]
}

// Get specific merchant details
GET /business/merchant/:merchantId
Response: {
    id: string,
    domain: string,
    name: string,
    ownerWallet: `0x${string}`,
    bankAddress: `0x${string}` | null,
    config: object | null,
    verifiedAt: string | null,
    createdAt: string | null,
    role: "owner" | "admin" | "none"
}
```

### Merchant Registration

```typescript
// Get DNS TXT record for domain verification
GET /business/merchant/register/dns-txt?domain=example.com
Response: { dnsTxt: string }

// Verify domain ownership
GET /business/merchant/register/verify?domain=example.com&setupCode=optional
Response: {
    isDomainValid: boolean,
    isAlreadyRegistered: boolean
}

// Get SIWE statement for registration
GET /business/merchant/register/statement?domain=example.com
Response: { statement: string }

// Register new merchant
POST /business/merchant/register
Body: {
    message: string,        // SIWE message
    signature: `0x${string}`,
    domain: string,
    name: string,
    setupCode?: string      // Alternative to DNS verification
}
Response: { merchantId: string }
```

### Campaign Management

```typescript
// List campaigns for merchant
GET /business/merchant/:merchantId/campaigns?status=draft,active,paused,archived
Response: { campaigns: Campaign[] }

// Get single campaign
GET /business/merchant/:merchantId/campaigns/:campaignId
Response: Campaign

// Create campaign
POST /business/merchant/:merchantId/campaigns
Body: {
    name: string,
    rule: {
        trigger: "purchase" | "signup" | "wallet_connect" | "custom",
        conditions: Condition[],
        rewards: Reward[]
    },
    metadata?: object,
    budgetConfig?: BudgetConfig[],
    expiresAt?: string,     // ISO date
    priority?: number
}

// Update campaign
PUT /business/merchant/:merchantId/campaigns/:campaignId
Body: { /* partial campaign fields */ }

// Campaign lifecycle
POST /business/merchant/:merchantId/campaigns/:campaignId/publish
POST /business/merchant/:merchantId/campaigns/:campaignId/pause
POST /business/merchant/:merchantId/campaigns/:campaignId/resume
POST /business/merchant/:merchantId/campaigns/:campaignId/archive

// Delete campaign
DELETE /business/merchant/:merchantId/campaigns/:campaignId
```

#### Campaign Rule Schema

```typescript
type CampaignRule = {
    trigger: "purchase" | "signup" | "wallet_connect" | "custom";
    conditions: {
        field: string;       // e.g., "purchase.amount", "attribution.source"
        operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "in" | "not_in" | "contains" | "starts_with" | "ends_with" | "exists" | "not_exists";
        value: unknown;
    }[];
    rewards: {
        recipient: "referrer" | "referee" | "user";
        type: "token" | "discount" | "points";
        amountType: "fixed" | "percentage" | "tiered" | "range";
        amount?: number;
        percent?: number;
        percentOf?: string;
        tiers?: { minValue: number; maxValue?: number; amount: number }[];
        baseAmount?: number;
        minMultiplier?: number;
        maxMultiplier?: number;
        token?: `0x${string}`;
        description?: string;
        chaining?: {
            userPercent: number;
            deperditionPerLevel: number;
            maxDepth?: number;
        };
    }[];
};

type BudgetConfig = {
    label: string;
    durationInSeconds: number | null;  // null = unlimited
    amount: number;
}[];
```

### Admin Management (Roles)

```typescript
// List admins for merchant
GET /business/merchant/:merchantId/admins
Response: {
    admins: [{
        id: string,
        wallet: `0x${string}`,
        addedBy: `0x${string}`,
        addedAt: string
    }]
}

// Add admin
POST /business/merchant/:merchantId/admins
Body: { wallet: `0x${string}` }

// Remove admin
DELETE /business/merchant/:merchantId/admins/:wallet
```

### Ownership Transfer

```typescript
// Get pending transfer status
GET /business/merchant/:merchantId/transfer
Response: {
    pending: false
} | {
    pending: true,
    fromWallet: `0x${string}`,
    toWallet: `0x${string}`,
    initiatedAt: string,
    expiresAt: string
}

// Get statement for initiating transfer
GET /business/merchant/:merchantId/transfer/statement/initiate?toWallet=0x...
Response: { statement: string }

// Initiate transfer
POST /business/merchant/:merchantId/transfer/initiate
Body: {
    message: string,
    signature: `0x${string}`,
    toWallet: `0x${string}`
}

// Get statement for accepting transfer
GET /business/merchant/:merchantId/transfer/statement/accept
Response: { statement: string }

// Accept transfer
POST /business/merchant/:merchantId/transfer/accept
Body: {
    message: string,
    signature: `0x${string}`
}

// Cancel transfer
DELETE /business/merchant/:merchantId/transfer
```

### Webhook Configuration

```typescript
// Get webhook status
GET /business/merchant/:merchantId/webhooks
Response: {
    setup: false
} | {
    setup: true,
    platform: "shopify" | "woocommerce" | "custom" | "internal",
    webhookSigninKey: string,
    stats: {
        firstPurchase?: Date,
        lastPurchase?: Date,
        lastUpdate?: Date,
        totalPurchaseHandled?: number
    }
}

// Configure webhook
POST /business/merchant/:merchantId/webhooks
Body: {
    hookSignatureKey: string,
    platform: "shopify" | "woocommerce" | "custom" | "internal"
}

// Delete webhook
DELETE /business/merchant/:merchantId/webhooks
```

### Notifications

```typescript
// Send notification to users
POST /business/notifications/send
Body: {
    targets: {
        wallets: `0x${string}`[]
    } | {
        filter: object  // Indexer filter
    },
    payload: {
        title: string,
        body: string,
        // ... other notification options
    }
}
```

### Funding (Dev/Test Only)

```typescript
// Get test tokens for a bank
POST /business/funding/getTestToken
Body: {
    bank: `0x${string}`,
    stablecoin?: "eure" | "gbpe" | "usde" | "usdc"
}
```

---

## Anonymous User Flow

### Overview

The new architecture supports **anonymous users** who can:
1. Click referral links
2. Make purchases
3. Earn rewards

All **before** connecting a wallet. Rewards are "locked" until wallet connection.

### Headers

| Header | Purpose | When to Send |
|--------|---------|--------------|
| `x-frak-client-id` | Anonymous fingerprint ID | All tracking requests when user has no wallet |
| `x-wallet-sdk-auth` | SDK JWT token | When user has connected wallet |

### Flow Diagram

```
1. User Arrives (Anonymous)
   └── SDK generates clientId from fingerprint + merchantId
   └── POST /user/track/arrival
       Headers: { "x-frak-client-id": "anon_abc123..." }
       Body: { merchantId, referrerWallet?, landingUrl?, utm* }
   └── Response: { identityGroupId, touchpointId }

2. User Makes Purchase (Still Anonymous)
   └── Webhook receives purchase from e-commerce platform
   └── SDK calls: POST /user/track/purchase
       Headers: { "x-frak-client-id": "anon_abc123..." }
       Body: { customerId, orderId, token, merchantId }
   └── Backend links anonymous ID to purchase

3. User Connects Wallet (Later)
   └── POST /user/wallet/auth/login or /register
       Headers: { "x-frak-client-id": "anon_abc123..." }  // IMPORTANT!
       Body: { ...auth params, merchantId }
   └── Backend merges anonymous identity with wallet
   └── Locked rewards become claimable
```

### SDK Identity Resolution

The backend uses `resolveSdkIdentity()` to handle both anonymous and authenticated requests:

```typescript
// Headers schema
{
    "x-frak-client-id"?: string,   // Anonymous fingerprint
    "x-wallet-sdk-auth"?: string   // Wallet SDK JWT
}

// At least one must be present for tracking routes
// Both can be present during wallet connection to merge identities
```

---

## Authentication Headers

### Summary Table

| Header | Used For | Format | Required In |
|--------|----------|--------|-------------|
| `x-frak-client-id` | Anonymous tracking | String (fingerprint) | `/user/track/*` (anonymous) |
| `x-wallet-sdk-auth` | SDK authentication | JWT string | `/user/track/*` (authenticated) |
| `x-wallet-auth` | Wallet app authentication | JWT string | `/user/wallet/*` (most routes) |
| `x-business-auth` | Business dashboard auth | JWT string | `/business/*` (all routes) |

### JWT Token Flows

**Wallet SDK JWT** (`x-wallet-sdk-auth`):
- Generated via `/user/wallet/auth/sdk/generate`
- Or via `/user/wallet/auth/sdk/fromWebAuthNSignature`
- Contains: `{ address, exp }`

**Wallet Auth JWT** (`x-wallet-auth`):
- Generated during login/register
- Contains: `{ address, type, authenticatorId, publicKey, sub, iat }`

**Business Auth JWT** (`x-business-auth`):
- Generated via `/business/auth/login` (SIWE)
- Contains: `{ wallet, siwe: { message, signature }, sub, iat }`

---

## Important Considerations

### Anonymous ID Handling

**This section is critical for correct reward attribution!**

The anonymous ID (`x-frak-client-id`) must be transmitted in these scenarios:

#### 1. SSO Flow (Opening Wallet from Embed)
When redirecting to wallet for SSO authentication:
```
MUST SEND: anonymous ID + merchant ID
```
The wallet login/register endpoints accept both headers AND body params:
```typescript
POST /user/wallet/auth/login
Headers: { "x-frak-client-id": "anon_..." }
Body: { ..., merchantId: "uuid" }
```

#### 2. Redirecting Out of Embed Browser
When redirecting user out of an in-app browser (Instagram, TikTok, etc.):
```
MUST PRESERVE: anonymous ID in URL or session
```
Pass the anonymous ID so it can be re-attached after redirect.

#### 3. During Registration
When user creates a new wallet:
```typescript
POST /user/wallet/auth/register
Headers: { "x-frak-client-id": "anon_..." }  // If available
Body: {
    // ... registration params
    merchantId: "uuid"  // Optional but recommended
}
```

#### 4. Identity Merge Route (Coming Soon)
A new route will be available to merge multiple anonymous IDs:
```typescript
// FUTURE ENDPOINT
POST /user/identity/merge
Body: {
    anonymousIds: string[],  // Multiple client IDs to merge
    walletAddress?: `0x${string}`
}
```
Use case: User visited on multiple devices/browsers before connecting wallet.

### Identity Resolution Rules

1. **One wallet per identity group** - Wallet is the "anchor"
2. **First referrer wins** - Per merchant, first click establishes relationship
3. **Anonymous IDs are merchant-scoped** - Same fingerprint creates different nodes per merchant
4. **Wallet IDs are global** - One wallet connects all merchant relationships

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Same user, different devices | Separate identity groups until wallet connects |
| Connect wallet on device A, then device B | Groups merge, rewards consolidated |
| Anonymous purchase, then connect wallet | Locked rewards unlock and become claimable |
| Multiple anonymous IDs, same person | Use merge endpoint (coming soon) |

---

## Migration Checklist

### Wallet App

- [ ] Update all `/wallet/*` routes to `/user/wallet/*`
- [ ] Pass `x-frak-client-id` header during login/register when available
- [ ] Pass `merchantId` in body during login/register when SSO from merchant
- [ ] Implement anonymous ID preservation during embed browser redirects
- [ ] Update balance endpoints to new paths

### Business Dashboard

- [ ] Implement new `/business/auth/login` SIWE flow
- [ ] Store JWT token and include in `x-business-auth` header
- [ ] Update merchant management to use new routes
- [ ] Implement campaign CRUD with new rule schema
- [ ] Update admin management UI
- [ ] Add webhook configuration UI
- [ ] Handle ownership transfer flows

### SDK

- [ ] Generate and persist `clientId` (fingerprint + merchantId)
- [ ] Always send `x-frak-client-id` for anonymous users
- [ ] Send `x-wallet-sdk-auth` when wallet is connected
- [ ] Update purchase tracking to `/user/track/purchase`
- [ ] Update arrival tracking to `/user/track/arrival`
- [ ] Pass merchant context during SSO redirect

### API Client Updates

```typescript
// Old (delete these)
import { WalletApp } from "@frak-labs/client";

// New
import { UserApp, BusinessApp } from "@frak-labs/client";

// Route type exports changed
export type App = typeof app;
export type BusinessApp = typeof businessApi;
export type UserApp = typeof userApi;
export type CommonApp = typeof commonApi;
```

---

## Questions?

Refer to:
- `REFACTO_ARCHITECTURE.md` - Full architectural details
- `AGENTS.md` - Backend structure documentation
- Backend source: `services/backend/src/api/`

---

*Document generated from backend source code analysis.*
