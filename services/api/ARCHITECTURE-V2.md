# Frak V2: Hybrid Loyalty & Attribution Engine

**Status**: Draft  
**Last Updated**: 2025-01-03  
**Branch**: TBD (v2-hybrid-engine)  
**Authors**: Frak Engineering

---

## Executive Summary

Frak V2 represents a fundamental paradigm shift from blockchain-centric to **web2-first with blockchain as settlement layer**. The goal is to be more transparent than Web2 affiliates (Google Analytics, Impact) while being more user-friendly than pure Web3 protocols.

### Core Value Propositions

| Capability | Value |
|------------|-------|
| **Defensive Attribution** | Prevents "Coupon Hijacking" via lookback windows and source priority |
| **Identity Resolution** | Rewards users for purchases made before wallet connection |
| **Hybrid Rewards** | Zero gas for small transactions, non-custodial safety for crypto |
| **Remote Configuration** | Merchants control SDK appearance and rules without code deploys |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Split-Brain Event Strategy](#2-split-brain-event-strategy)
3. [Phase 1: P2P Referral Core](#3-phase-1-p2p-referral-core)
4. [Identity Graph](#4-identity-graph)
5. [Attribution Engine](#5-attribution-engine)
6. [Campaign & Reward Engine](#6-campaign--reward-engine)
7. [Smart Contract Layer](#7-smart-contract-layer)
8. [System Modules](#8-system-modules)
9. [User Journey](#9-user-journey)
10. [Migration Strategy](#10-migration-strategy)
11. [Critical Considerations](#11-critical-considerations)
12. [Phase 1 Deliverables](#12-phase-1-deliverables)

**Appendices** (see separate files):
- [Appendix A: Glossary](./ARCHITECTURE-V2-APPENDIX.md#appendix-a-glossary)
- [Appendix B: API Endpoints](./ARCHITECTURE-V2-APPENDIX.md#appendix-b-api-endpoints)
- [Appendix C: Event Types](./ARCHITECTURE-V2-APPENDIX.md#appendix-c-event-types)
- [Appendix D: SDK Anonymous ID](./ARCHITECTURE-V2-APPENDIX.md#appendix-d-sdk-anonymous-id-implementation)
- [Appendix E: Rule Engine Types](./ARCHITECTURE-V2-APPENDIX.md#appendix-e-rule-engine-typescript-types)

---

## 1. Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MERCHANT WEBSITE                                │
│  ┌─────────────┐                                                            │
│  │  Frak SDK   │ ──────────────────────────────────────────────────────┐    │
│  │  (Latest)   │                                                       │    │
│  └─────────────┘                                                       │    │
└────────────────────────────────────────────────────────────────────────│────┘
                                                                         │
                              ┌──────────────────────────────────────────▼────┐
                              │              FRAK API (Elysia.js)              │
                              │                                                │
                              │  ┌──────────────────────────────────────────┐  │
                              │  │              DOMAINS                      │  │
                              │  │                                          │  │
                              │  │  ┌────────────┐    ┌─────────────────┐   │  │
                              │  │  │  Identity  │    │   Attribution   │   │  │
                              │  │  │   Graph    │    │     Engine      │   │  │
                              │  │  └────────────┘    └─────────────────┘   │  │
                              │  │                                          │  │
                              │  │  ┌────────────┐    ┌─────────────────┐   │  │
                              │  │  │  Campaign  │    │     Ledger      │   │  │
                              │  │  │   Engine   │    │   (Rewards)     │   │  │
                              │  │  └────────────┘    └─────────────────┘   │  │
                              │  │                                          │  │
                              │  │  ┌────────────┐    ┌─────────────────┐   │  │
                              │  │  │  Merchant  │    │    Analytics    │   │  │
                              │  │  │   Config   │    │   (OpenPanel)   │   │  │
                              │  │  └────────────┘    └─────────────────┘   │  │
                              │  └──────────────────────────────────────────┘  │
                              │                                                │
                              │  ┌──────────────────────────────────────────┐  │
                              │  │           INFRASTRUCTURE                  │  │
                              │  │  PostgreSQL │ Blockchain │ OpenPanel      │  │
                              │  └──────────────────────────────────────────┘  │
                              └────────────────────────────────────────────────┘
                                                     │
                                                     │ Daily Batch
                                                     ▼
                              ┌────────────────────────────────────────────────┐
                              │            BLOCKCHAIN (Settlement)             │
                              │                                                │
                              │  ┌──────────────────────────────────────────┐  │
                              │  │              VAULT CONTRACT              │  │
                              │  │                                          │  │
                              │  │  batchSetAllocation() ◄── Backend Worker │  │
                              │  │  claim()              ◄── User Wallet    │  │
                              │  │                                          │  │
                              │  │  Attestation Objects (future: ZKP)       │  │
                              │  └──────────────────────────────────────────┘  │
                              └────────────────────────────────────────────────┘
```

### Directory Structure

```
services/
└── api/                      # NEW: V2 Backend (Elysia.js)
    ├── src/
    │   ├── core/             # Technical Foundation
    │   │   ├── errors/       # AppError, ErrorHandler
    │   │   ├── events/       # TypedEventEmitter (Internal Bus)
    │   │   ├── config.ts     # Env vars & Constants
    │   │   └── logger.ts     # Structured Logger
    │   │
    │   ├── domains/          # Business Logic (Bounded Contexts)
    │   │   ├── identity/     # Graph resolution, merging
    │   │   ├── attribution/  # Touchpoints, lookback, source priority
    │   │   ├── campaign/     # Rules engine, reward calculation
    │   │   ├── ledger/       # Asset logs, soft/hard rewards, on-chain sync
    │   │   ├── merchant/     # Config, webhooks, dashboard settings
    │   │   └── analytics/    # OpenPanel proxy, event ingestion
    │   │
    │   ├── infrastructure/   # External Adapters
    │   │   ├── blockchain/   # Viem client, Vault ABI
    │   │   ├── persistence/  # PostgreSQL (Drizzle)
    │   │   └── openpanel/    # Analytics wrapper
    │   │
    │   ├── interfaces/       # Entry Points
    │   │   ├── http/
    │   │   │   ├── guards/   # Auth middlewares (Webhook, SDK, User)
    │   │   │   └── routes/   # /track, /auth, /rewards, /merchants
    │   │   └── workers/      # Cron jobs (Chain sync, reward batching)
    │   │
    │   └── index.ts          # App entry
    │
    └── package.json
```

---

## 2. Split-Brain Event Strategy

### The Philosophy

We separate **Operational Events** (state changes, money) from **Analytical Events** (trends, insights). This routing happens **in the SDK**, not the backend. This ensures:

1. **Ad-blocker resilience**: If OpenPanel is blocked, rewards still work
2. **Failure isolation**: OpenPanel downtime doesn't affect core business logic
3. **Clean separation**: Backend only receives events it needs to act on

### Event Classification

| Feature | Operational Stream (Frak Backend) | Analytical Stream (OpenPanel) |
|---------|----------------------------------|------------------------------|
| **Routed By** | SDK → Frak API | SDK → OpenPanel directly |
| **Purpose** | Triggering Logic & Money. Events that change system state. | Insights & Funnels. Events that show merchant trends. |
| **Storage** | Permanent `event_stream` table (PostgreSQL) | OpenPanel / ClickHouse |
| **Volume** | Low Volume / High Value | High Volume / Low Value |
| **Failure Impact** | **CRITICAL** - System cannot function | **ACCEPTABLE** - Dashboards degrade gracefully |
| **Ad-Blocker Impact** | Not affected (first-party API) | May be blocked (third-party) |

### Event Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL EVENTS                                   │
│                    (Always stored in PostgreSQL)                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ referral_arrival│  │ wallet_connect  │  │    purchase     │             │
│  │                 │  │                 │  │                 │             │
│  │ User landed via │  │ Wallet linked   │  │ Order completed │             │
│  │ ?ref=0x...      │  │ to identity     │  │ via webhook     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ account_create  │  │ reward_claimed  │  │ identity_merge  │             │
│  │                 │  │                 │  │                 │             │
│  │ New identity    │  │ On-chain claim  │  │ Two identities  │             │
│  │ group created   │  │ executed        │  │ combined        │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICAL EVENTS                                    │
│                      (OpenPanel only - disposable)                          │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   page_view     │  │  add_to_cart    │  │  button_click   │             │
│  │                 │  │                 │  │                 │             │
│  │ Generic page    │  │ Unless triggers │  │ UI interaction  │             │
│  │ navigation      │  │ specific rule   │  │ tracking        │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  scroll_depth   │  │ session_start   │  │  form_abandon   │             │
│  │                 │  │                 │  │                 │             │
│  │ Engagement      │  │ Visit tracking  │  │ Funnel analysis │             │
│  │ metrics         │  │                 │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Rule

> **"Does this event potentially result in a reward, a merge, or a payout?"**
> 
> - **YES** → Operational Event → Store in PostgreSQL
> - **NO** → Analytical Event → Send to OpenPanel only

### Operational Event Schema

```sql
CREATE TYPE operational_event_type AS ENUM (
    'referral_arrival',     -- User landed via referral link
    'wallet_connect',       -- Wallet linked to identity group
    'purchase',             -- Purchase completed (webhook)
    'account_create',       -- New identity group created
    'identity_merge',       -- Two identity groups merged
    'reward_created',       -- Reward logged to ledger
    'reward_ready',         -- Reward cleared for distribution
    'reward_settled',       -- Reward pushed to blockchain
    'reward_claimed'        -- User claimed on-chain
);

CREATE TABLE event_stream (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      operational_event_type NOT NULL,
    
    -- Core references
    identity_group_id   UUID REFERENCES identity_groups(id),
    merchant_id         UUID REFERENCES merchants(id),
    
    -- Event payload (type-specific data)
    payload         JSONB NOT NULL,
    
    -- Correlation
    correlation_id  UUID,           -- Links related events
    causation_id    UUID,           -- What triggered this event
    
    -- Timestamps
    occurred_at     TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexing
    INDEX idx_event_stream_type (event_type),
    INDEX idx_event_stream_identity (identity_group_id),
    INDEX idx_event_stream_merchant (merchant_id),
    INDEX idx_event_stream_occurred (occurred_at),
    INDEX idx_event_stream_correlation (correlation_id)
);
```

### Event Flow Architecture (SDK-Side Routing)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRAK SDK (Client-Side)                          │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                      EVENT ROUTER (in SDK)                          │    │
│   │                                                                     │    │
│   │   User Action → classify(event) → 'operational' | 'analytical'     │    │
│   │                                                                     │    │
│   └─────────────┬─────────────────────────────────┬────────────────────┘    │
│                 │                                 │                         │
│                 │ Operational                     │ Analytical              │
│                 │ (rewards, identity)             │ (trends, funnels)       │
│                 │                                 │                         │
│                 ▼                                 ▼                         │
│   ┌─────────────────────────┐       ┌─────────────────────────┐            │
│   │     Frak Backend API    │       │       OpenPanel         │            │
│   │                         │       │                         │            │
│   │  POST /track/arrival    │       │  • May be ad-blocked    │            │
│   │  POST /identity/resolve │       │  • Fire and forget      │            │
│   │                         │       │  • Graceful degradation │            │
│   │  • MUST succeed         │       │                         │            │
│   │  • Retry until works    │       │                         │            │
│   └─────────────────────────┘       └─────────────────────────┘            │
│                                                                              │
│   Some events sent to BOTH (operational events also forwarded to OpenPanel  │
│   for unified dashboards - but OpenPanel failure doesn't block the flow)    │
└─────────────────────────────────────────────────────────────────────────────┘

                 │
                 │ Webhooks (Shopify, WooCommerce) go directly to backend
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRAK BACKEND                                    │
│                                                                              │
│   event_stream (PostgreSQL)  →  Domain Event Bus  →  Business Logic         │
│                                                                              │
│   • Attribution evaluation                                                  │
│   • Reward calculation                                                      │
│   • Identity merging                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SDK Event Router Implementation

```typescript
// SDK-side event routing
class FrakEventRouter {
    constructor(
        private frakApi: FrakApiClient,      // Our backend
        private openPanel: OpenPanelClient,   // Analytics (may be blocked)
        private config: { merchantId: string; anonId: string }
    ) {}
    
    async track(event: TrackingEvent): Promise<void> {
        const classification = this.classify(event);
        
        if (classification === 'operational' || classification === 'both') {
            // MUST succeed - retry until it works
            await this.frakApi.track(event, {
                retries: 3,
                backoff: 'exponential',
            });
        }
        
        if (classification === 'analytical' || classification === 'both') {
            // Best effort - don't block on failure
            this.openPanel.track(event.type, {
                ...event.data,
                frak_anon_id: this.config.anonId,  // Correlation key
            }).catch(() => {
                // Silently fail - ad-blocker or network issue
            });
        }
    }
    
    private classify(event: TrackingEvent): 'operational' | 'analytical' | 'both' {
        const operationalOnly = ['wallet_connect', 'identity_merge'];
        const both = ['referral_arrival', 'purchase'];  // Sent to both
        const analyticalOnly = ['page_view', 'add_to_cart', 'scroll_depth', 'button_click'];
        
        if (operationalOnly.includes(event.type)) return 'operational';
        if (both.includes(event.type)) return 'both';
        return 'analytical';
    }
}
```

### Why SDK-Side Routing?

| Concern | SDK Routing | Backend Routing |
|---------|-------------|-----------------|
| **Ad-blockers** | OpenPanel blocked → rewards still work | Would need backend proxy (complexity) |
| **Latency** | Parallel requests to both targets | Sequential: SDK → Backend → OpenPanel |
| **Failure isolation** | OpenPanel failure = silent drop | Backend must handle OpenPanel errors |
| **Simplicity** | SDK decides what goes where | Backend needs routing logic |

---

## 3. Phase 1: P2P Referral Core

### The Concept

Phase 1 strips away complexity to validate the core hypothesis: **Wallet-based P2P referrals work at scale.**

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1: SIMPLICITY                         │
│                                                                 │
│   • Identity = Wallet                                          │
│   • Referral Code = Wallet Address                             │
│   • Logic = Pure P2P (Alice invites Bob)                       │
│   • Rewards = Fixed Global Rule per Merchant                   │
│                                                                 │
│   NO: Campaign codes, time-based rules, tiered rewards         │
└─────────────────────────────────────────────────────────────────┘
```

### The Referral Link

The referral code IS the wallet address. No mapping tables, no custom codes.

```
Format:   https://myshop.com?ref=0x1234567890abcdef...

Examples:
  https://acme-store.com?ref=0xAlice
  https://fashion-brand.com/products/shirt?ref=0xBob&utm_source=twitter
```

**Why wallet as code?**
- No database lookup to resolve codes
- Self-service: users generate links without backend calls  
- Verifiable: wallet ownership provable on-chain
- Future-proof: same format works with ZKP attestations

### The Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Alice     │         │     Bob     │         │   Merchant  │
│  (Referrer) │         │  (Referee)  │         │   Website   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Connect Wallet    │                       │
       │  ─────────────────►   │                       │
       │                       │                       │
       │  2. Share Link        │                       │
       │  myshop.com?ref=      │                       │
       │  0xAlice              │                       │
       │  ─────────────────────┼──────────────────────►│
       │                       │                       │
       │                       │  3. Click Link        │
       │                       │  ─────────────────────►
       │                       │                       │
       │                       │  4. SDK records       │
       │                       │     touchpoint        │
       │                       │  ◄─────────────────────
       │                       │                       │
       │                       │  5. Browse & Buy      │
       │                       │  ─────────────────────►
       │                       │                       │
       │                       │                       │  6. Webhook
       │                       │                       │  ─────────►
       │                       │                       │    Backend
       │                       │                       │
       │  7. Reward: 10 USDC   │  7. Reward: 5% off   │
       │  ◄────────────────────┼───────────────────────│
       │                       │                       │
```

### Global Merchant Rule (Phase 1)

Each merchant has ONE active referral rule. No campaigns, no complexity.

```typescript
interface Phase1MerchantConfig {
    merchantId: string;
    
    // The single referral rule
    referralRule: {
        // Referrer reward (requires wallet)
        referrerReward: {
            type: 'token';
            token: 'USDC';
            amount: number;          // Fixed amount, e.g., 10
        };
        
        // Referee reward (can be claimed without wallet initially)
        refereeReward: {
            type: 'discount';
            amount: number;          // e.g., 5
            unit: 'percent' | 'fixed';
        };
        
        // Basic constraints
        minPurchaseAmount?: number;  // Minimum order value
        maxRewardsPerReferrer?: number;  // Daily/total cap
    };
    
    // Clearance period before rewards are claimable
    clearanceDays: number;  // Default: 14
}
```

### Database Representation

In Phase 1, the JSON rule engine stores a simple, fixed structure:

```json
{
    "trigger": "purchase",
    "conditions": [
        { "field": "attribution.source", "operator": "eq", "value": "referral_link" }
    ],
    "rewards": [
        {
            "recipient": "referrer",
            "type": "token",
            "amount": 10,
            "token": "USDC"
        },
        {
            "recipient": "referee", 
            "type": "discount",
            "amount": 5,
            "unit": "percent"
        }
    ]
}
```

### Identity Requirements

| Action | Wallet Required? | Notes |
|--------|-----------------|-------|
| Generate referral link | **YES** | Link IS the wallet address |
| Click referral link | NO | Anonymous ID tracks the touchpoint |
| Make purchase | NO | Can buy as guest |
| Receive discount (referee) | NO | Applied at checkout |
| Claim USDC (referrer) | **YES** | Must have wallet to claim on-chain |
| Claim USDC (referee cashback) | **YES** | Must connect wallet to claim |

### Why Phase 1 Matters

This is our **validation phase**. We're proving:

1. **Technical**: The split-brain event system handles real traffic
2. **Economic**: P2P referrals drive measurable merchant value
3. **UX**: Wallet-based identity doesn't kill conversion
4. **Scale**: The system handles merchant-scale purchase volumes

**Success Criteria**:
- 3+ merchants onboarded
- 1000+ attributed purchases tracked
- <500ms webhook processing p99
- Zero reward calculation errors

### What Phase 1 Explicitly Excludes

| Feature | Phase 1 | Phase 2+ |
|---------|---------|----------|
| Custom referral codes | NO | `summer_sale_24` → `0xAlice` |
| Time-based multipliers | NO | "2x rewards on weekends" |
| Tiered rewards | NO | "10% for first 10 referrals, then 5%" |
| Multi-token rewards | NO | USDC + loyalty points |
| Browser extension tracking | NO | Extension-based attribution |
| Named campaigns | NO | "Black Friday 2024" campaign |

---

## 4. Identity Graph

### Core Concept

The Identity Graph merges multiple identifiers into a single "Human Entity":

```
┌─────────────────────────────────────────────────────────────────┐
│                      IDENTITY GROUP                             │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│   │  Anon ID    │   │ Shopify ID  │   │   Wallet (Anchor)   │  │
│   │ merchant_a  │   │ merchant_a  │   │   0xABC...          │  │
│   └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐                            │
│   │  Anon ID    │   │ Shopify ID  │   (same wallet connects    │
│   │ merchant_b  │   │ merchant_b  │    to merchant_b later)    │
│   └─────────────┘   └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### Anonymous ID Generation

Instead of cookies, we use **browser fingerprint-based anonymous IDs** stored in session/local storage:

```typescript
interface AnonymousIdConfig {
    // Storage strategy
    storage: 'sessionStorage' | 'localStorage';  // localStorage for persistence across sessions
    
    // Fingerprint components (reproducible per browser)
    fingerprint: {
        userAgent: string;
        language: string;
        timezone: string;
        screenResolution: string;
        colorDepth: number;
        platform: string;
        // Canvas/WebGL fingerprint (optional, more entropy)
        canvasHash?: string;
    };
}

// Generation algorithm
function generateAnonymousId(merchantId: string): string {
    const fingerprint = collectFingerprint();
    const hash = sha256(JSON.stringify(fingerprint) + merchantId);
    
    // Store in localStorage for persistence
    const storageKey = `frak_anon_${merchantId}`;
    let anonId = localStorage.getItem(storageKey);
    
    if (!anonId) {
        anonId = `anon_${hash.slice(0, 32)}`;
        localStorage.setItem(storageKey, anonId);
    }
    
    return anonId;
}
```

**Key Properties**:
- **Reproducible**: Same browser + same merchant = same anonymous ID
- **Per-Merchant Siloed**: Different merchants get different anonymous IDs (merchantId in hash)
- **Persistent**: Stored in localStorage, survives browser restarts
- **No Cookies**: Avoids cookie consent issues in many jurisdictions

### Visibility Rules

| Identity Type | Scope | Visibility |
|---------------|-------|------------|
| Anonymous ID (Fingerprint) | Per-merchant | Merchant who issued it only |
| Merchant Customer ID | Per-merchant | Merchant who issued it only |
| Wallet Address | Global | Cross-merchant (the anchor) |

**Key Rule**: Merchants can only see identities within their own graph subset. The wallet acts as the bridge connecting merchant-siloed identities.

### Hard Rules

1. **One Wallet Per Identity Group**: Cannot merge multiple wallets into the same group
2. **Wallet is Source of Truth**: High-value actions (cash rewards, referrals) require wallet connection
3. **Merge Combines Rewards**: When identities merge (e.g., 2 Shopify accounts connect same wallet), their accumulated rewards combine

### Merge Operations

```sql
-- Identity types
CREATE TYPE identity_type AS ENUM (
    'anonymous_fingerprint',  -- Browser fingerprint-based ID (localStorage)
    'merchant_customer',      -- Shopify/WooCommerce customer ID  
    'wallet'                  -- Ethereum wallet address (anchor)
);

-- Identity nodes
CREATE TABLE identity_nodes (
    id              UUID PRIMARY KEY,
    identity_type   identity_type NOT NULL,
    identity_value  TEXT NOT NULL,
    merchant_id     UUID,  -- NULL for wallet (global), set for others
    group_id        UUID NOT NULL REFERENCES identity_groups(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(identity_type, identity_value, merchant_id)
);

-- Identity groups (the "Human Entity")
CREATE TABLE identity_groups (
    id              UUID PRIMARY KEY,
    wallet_address  TEXT UNIQUE,  -- The anchor (NULL until wallet connected)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Merge Algorithm

```
MERGE(identity_a, identity_b):
    group_a = get_group(identity_a)
    group_b = get_group(identity_b)
    
    IF group_a == group_b:
        RETURN  // Already merged
    
    // Determine which group has wallet (anchor wins)
    IF group_a.wallet_address AND group_b.wallet_address:
        ERROR "Cannot merge: both groups have wallets"
    
    anchor_group = group_a.wallet_address ? group_a : group_b
    merge_group = group_a.wallet_address ? group_b : group_a
    
    // Move all identities to anchor group
    UPDATE identity_nodes SET group_id = anchor_group.id 
    WHERE group_id = merge_group.id
    
    // Combine rewards
    CALL combine_ledger_balances(anchor_group.id, merge_group.id)
    
    // Soft delete merge group
    DELETE identity_groups WHERE id = merge_group.id
```

### Dispute Resolution

When a user disputes a merge ("That wasn't me"):

1. Extract disputed identity from current group
2. Create new identity group with disputed identity
3. Split rewards proportionally (or per user claim)
4. New group waits for "real" user to connect wallet

```
DISPUTE(identity_node_id, reason):
    node = get_node(identity_node_id)
    old_group = node.group_id
    
    // Create isolated group
    new_group = CREATE identity_group
    
    // Move disputed identity
    UPDATE identity_nodes SET group_id = new_group.id 
    WHERE id = identity_node_id
    
    // Log for audit
    INSERT dispute_log (node_id, old_group, new_group, reason, timestamp)
    
    // Rewards stay with old group (conservative approach)
    // Or: call split_rewards(old_group, new_group, node) for proportional split
```

### OpenPanel Identity Integration

**Frak Anonymous ID is the source of truth.** No separate mapping table needed.

```typescript
// SDK initialization
async function initializeFrakSdk(merchantId: string) {
    // 1. Generate/retrieve Frak anonymous ID
    const frakAnonId = await generateAnonymousId(merchantId);
    
    // 2. Initialize OpenPanel with our ID as the profile
    const openPanel = new OpenPanel({
        clientId: OPEN_PANEL_SDK_CLIENT_ID,
        trackScreenViews: true,
    });
    
    // 3. Use Frak anon ID as OpenPanel profile ID
    openPanel.identify({ profileId: frakAnonId });
    
    return { frakAnonId, openPanel };
}

// When wallet connects, add wallet as alias (keep anon ID as primary)
async function onWalletConnected(wallet: Address, anonId: string, openPanel: OpenPanel) {
    openPanel.alias({ profileId: wallet, alias: anonId });
}
```

**Querying OpenPanel for analytics**: To get all events for an identity group, query OpenPanel with:

```typescript
// Get all profile IDs for the identity group
const identityNodes = await db.query(`
    SELECT identity_value FROM identity_nodes 
    WHERE group_id = $1
`, [identityGroupId]);

// Query OpenPanel with all known IDs
const profileIds = identityNodes.map(n => n.identity_value);
const events = await openPanel.query({
    profileId: { $in: profileIds },  // [anonId1, anonId2, walletAddress]
    // ... filters
});
```

**Why no mapping table?** OpenPanel already stores events by profileId. We use Frak anon IDs as profile IDs, so we can query directly. The identity_nodes table already tracks all IDs for a group.

### In-App Browser Identity Merging

**Problem**: Users clicking links in Instagram, Twitter, etc. open in-app browsers with different localStorage than the system browser. User then may be redirected to the real browser for checkout.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Instagram App   │      │  In-App Browser │      │ System Browser  │
│                 │      │                 │      │                 │
│  Click link     │─────►│  anon_id: A     │─────►│  anon_id: B     │
│                 │      │  (new storage)  │      │  (different!)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                         │
                                                         ▼
                                               User purchases, but
                                               attribution to referrer
                                               is lost!
```

**Solutions to Explore (Phase 2)**:

| Approach | How It Works | Tradeoffs |
|----------|--------------|-----------|
| **URL Parameter Passthrough** | Append `&frak_session=<token>` when redirecting to system browser | Requires merchant cooperation; token expiry |
| **Server-Side Session** | Store session on backend, retrieve via fingerprint match | Privacy concerns; fingerprint collision risk |
| **QR Code Bridge** | Show QR code in in-app browser, scan with system browser | UX friction; requires user action |
| **Deep Link** | Use `frak://` or universal links to open system browser with context | Requires app installation or universal link setup |
| **Probabilistic Match** | Match on IP + rough fingerprint within time window | False positives; not reliable for rewards |

**Phase 1 Limitation**: We accept that in-app browser sessions may not merge automatically. Users can manually connect wallet in system browser to claim rewards.

**Future API** (Phase 2):

```typescript
// When in-app browser detects redirect to system browser
const bridgeToken = await frakApi.createBridgeToken({
    anonId: currentAnonId,
    expiresIn: '5m',
});

// Redirect URL includes bridge token
window.location.href = `${targetUrl}?frak_bridge=${bridgeToken}`;

// System browser SDK checks for bridge token on init
async function initializeFrakSdk(merchantId: string) {
    const bridgeToken = new URLSearchParams(location.search).get('frak_bridge');
    
    if (bridgeToken) {
        // Merge in-app browser identity with system browser identity
        const bridgedAnonId = await frakApi.resolveBridgeToken(bridgeToken);
        if (bridgedAnonId) {
            await frakApi.mergeIdentities(bridgedAnonId, currentAnonId);
        }
    }
    // ... continue normal init
}
```

---

## 5. Attribution Engine

### Touchpoint Model

Every user interaction that could lead to attribution is recorded. **This is where P2P referral tracking lives.**

```sql
CREATE TYPE touchpoint_source AS ENUM (
    'referral_link',       -- ?ref=0xWallet (P2P referral)
    'organic_search',      -- Direct/SEO traffic
    'paid_ad',             -- UTM-tagged campaigns
    'social_share',        -- Social media links
    'email_campaign',      -- Newsletter links
    'custom_link',         -- Named campaign links (Phase 2)
    'direct'               -- No attribution source
);

CREATE TABLE touchpoints (
    id              UUID PRIMARY KEY,
    identity_group_id UUID NOT NULL REFERENCES identity_groups(id),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    source          touchpoint_source NOT NULL,
    
    -- Source-specific data
    source_data     JSONB NOT NULL,
    /*
     * For referral_link (P2P):
     *   { "referrer_wallet": "0xAlice", "ref_param": "0xAlice" }
     *
     * For paid_ad:
     *   { "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "summer" }
     *
     * For custom_link (Phase 2):
     *   { "link_code": "summer_sale_24", "referrer_wallet": "0xAlice" }
     */
    
    landing_url     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,  -- Lookback window expiry
    
    INDEX idx_touchpoints_group_merchant (identity_group_id, merchant_id),
    INDEX idx_touchpoints_expires (expires_at),
    INDEX idx_touchpoints_referrer ((source_data->>'referrer_wallet'))  -- For P2P queries
);
```

**P2P Referral Tracking**: When a user arrives via `?ref=0xAlice`, the SDK:
1. Extracts the referrer wallet from URL
2. Calls `POST /track/arrival` with the referrer
3. Backend creates a touchpoint with `source = 'referral_link'` and `source_data.referrer_wallet = '0xAlice'`
4. On purchase, attribution engine finds this touchpoint and credits `0xAlice`

### Attribution Rules Engine (JSON-Based)

Like campaign rules, attribution rules use flexible JSON for easy extensibility:

```sql
CREATE TABLE attribution_rules (
    id              UUID PRIMARY KEY,
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    name            TEXT NOT NULL,
    priority        INT NOT NULL,           -- Lower = higher priority (evaluated first)
    is_active       BOOLEAN DEFAULT true,
    
    -- Flexible JSON rule definition
    rule            JSONB NOT NULL,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(merchant_id, priority),
    INDEX idx_attribution_rules_merchant (merchant_id)
);
```

#### Attribution Rule JSON Structure

```typescript
interface AttributionRule {
    // Which touchpoint sources this rule handles
    sources: TouchpointSource[];          // ['referral_link', 'paid_ad', ...]
    
    // How far back to look for touchpoints
    lookbackDays: number;                 // 30
    
    // How to resolve conflicts when multiple touchpoints exist
    conflictResolution: 'first_touch' | 'last_touch' | 'highest_value' | 'linear';
    
    // Optional: Additional conditions
    conditions?: AttributionCondition[];
    
    // Optional: Source-specific priority within this rule
    sourcePriority?: TouchpointSource[];  // Ordered list, first = highest priority
}

interface AttributionCondition {
    field: string;        // 'touchpoint.age_hours', 'touchpoint.source_data.campaign', etc.
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'exists';
    value: any;
}
```

#### Example Attribution Rules

**1. Referral Links First (Default)**
```json
{
    "sources": ["referral_link"],
    "lookbackDays": 30,
    "conflictResolution": "first_touch",
    "conditions": [
        { "field": "touchpoint.age_hours", "operator": "lte", "value": 720 }
    ]
}
```

**2. Paid Ads Priority with Campaign Filter**
```json
{
    "sources": ["paid_ad"],
    "lookbackDays": 7,
    "conflictResolution": "last_touch",
    "conditions": [
        { "field": "touchpoint.source_data.utm_campaign", "operator": "exists", "value": true }
    ]
}
```

**3. Multi-Source with Priority Order**
```json
{
    "sources": ["referral_link", "social_share", "email_campaign", "paid_ad"],
    "lookbackDays": 14,
    "conflictResolution": "first_touch",
    "sourcePriority": ["referral_link", "social_share", "email_campaign", "paid_ad"]
}
```

#### Attribution Evaluation

```typescript
async function evaluateAttribution(
    identityGroupId: string,
    merchantId: string
): Promise<AttributionResult> {
    // Get merchant's attribution rules
    const rules = await db.query(`
        SELECT * FROM attribution_rules 
        WHERE merchant_id = $1 AND is_active = true
        ORDER BY priority ASC
    `, [merchantId]);
    
    for (const rule of rules) {
        const config = rule.rule as AttributionRule;
        
        // Find matching touchpoints
        const touchpoints = await db.query(`
            SELECT * FROM touchpoints
            WHERE identity_group_id = $1
            AND merchant_id = $2
            AND source = ANY($3)
            AND created_at > NOW() - INTERVAL '1 day' * $4
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at ASC
        `, [identityGroupId, merchantId, config.sources, config.lookbackDays]);
        
        if (touchpoints.length === 0) continue;
        
        // Apply conditions
        const filtered = touchpoints.filter(tp => 
            allConditionsMatch(config.conditions, { touchpoint: tp })
        );
        
        if (filtered.length === 0) continue;
        
        // Resolve conflicts
        const winner = resolveConflict(filtered, config);
        
        return {
            attributed: true,
            source: winner.source,
            touchpointId: winner.id,
            referrer: winner.source_data?.referrer_wallet,
            ruleId: rule.id
        };
    }
    
    return { attributed: false, source: 'direct' };
}
```

### Defensive Attribution Logic

```
ATTRIBUTE_PURCHASE(purchase_event):
    identity_group = resolve_identity(purchase_event.customer_id)
    merchant = purchase_event.merchant_id
    
    // Get all touchpoints within lookback window
    touchpoints = SELECT * FROM touchpoints 
        WHERE identity_group_id = identity_group.id
        AND merchant_id = merchant
        AND expires_at > NOW()
        ORDER BY created_at ASC
    
    IF touchpoints.empty:
        RETURN { attributed: false, source: 'direct' }
    
    // Apply merchant's attribution rules
    rules = get_attribution_rules(merchant)
    
    FOR rule IN rules ORDER BY priority:
        matching = touchpoints.filter(t => rule.source_types.includes(t.source))
        IF matching.not_empty:
            winner = CASE rule.conflict_mode
                WHEN 'first_touch': matching.first()
                WHEN 'last_touch': matching.last()
                WHEN 'linear': matching  // Split credit
            
            RETURN { 
                attributed: true, 
                source: winner.source,
                touchpoint_id: winner.id,
                referrer: winner.source_data.referrer_wallet
            }
    
    RETURN { attributed: false, source: 'direct' }
```

### Anti-Fraud Checks

Before crediting a referrer:

```
VALIDATE_ATTRIBUTION(attribution_result, purchase_event):
    IF NOT attribution_result.attributed:
        RETURN VALID
    
    referrer = attribution_result.referrer
    buyer_group = resolve_identity(purchase_event.customer_id)
    
    // Self-referral check (graph-based)
    IF buyer_group.wallet_address == referrer:
        RETURN REJECT("self_referral")
    
    // Velocity check (too many referrals too fast)
    recent_referrals = COUNT referrals 
        WHERE referrer = referrer 
        AND created_at > NOW() - INTERVAL '1 hour'
    
    IF recent_referrals > merchant.max_referrals_per_hour:
        RETURN FLAG("velocity_exceeded")
    
    // Wallet activity check
    IF NOT is_wallet_active(referrer):
        RETURN FLAG("inactive_referrer")
    
    RETURN VALID
```

---

## 6. Campaign & Reward Engine

### Reward Types

| Type | Storage | Distribution | Example |
|------|---------|--------------|---------|
| **Soft** | PostgreSQL only | Instant | Discounts, XP, Store Credit |
| **Hard** | PostgreSQL + Blockchain | Batched Push/Pull | USDC, ETH, Tokens |

### JSON-Based Rule Engine

The rule engine uses **flexible JSON schemas** instead of rigid enums, enabling easy addition of new triggers, conditions, and reward types without schema migrations.

#### Campaign Rules Schema

```sql
CREATE TABLE campaign_rules (
    id              UUID PRIMARY KEY,
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    name            TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    priority        INT DEFAULT 0,          -- Higher = evaluated first
    
    -- Flexible JSON rule definition
    rule            JSONB NOT NULL,
    
    -- Budget constraints
    budget          JSONB,                  -- { daily: 1000, total: 50000, currency: 'USDC' }
    
    -- Touchpoint coupling (Phase 2): campaign only triggers for specific touchpoints
    -- Example: Newsletter campaign only triggers for users who clicked newsletter link
    linked_touchpoint_source    touchpoint_source,      -- e.g., 'custom_link'
    linked_touchpoint_code      TEXT,                   -- e.g., 'newsletter_jan_2025'
    /*
     * When set, this campaign ONLY activates if the attributed touchpoint matches:
     *   - source = linked_touchpoint_source
     *   - source_data->>'link_code' = linked_touchpoint_code (for custom_link)
     * 
     * This enables: "Newsletter subscribers get 15% off, others get 10%"
     */
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    
    INDEX idx_campaign_rules_merchant (merchant_id),
    INDEX idx_campaign_rules_active (merchant_id, is_active) WHERE is_active = true
);
```

**Touchpoint-Campaign Coupling (Phase 2)**: A campaign can be tightly coupled to a specific touchpoint. For example:
- Newsletter link `newsletter_jan_2025` → triggers "Newsletter VIP" campaign with 15% reward
- Generic referral link → triggers default "Referral" campaign with 10% reward

This allows multiple campaigns to coexist, each activated by different entry points.

#### Rule JSON Structure

```typescript
interface CampaignRule {
    // Trigger: what event activates this rule
    trigger: 'purchase' | 'referral_purchase' | 'signup' | 'custom';
    
    // Conditions: additional filters (all must match)
    conditions?: RuleCondition[];
    
    // Rewards: what to distribute
    rewards: RewardDefinition[];
}

interface RuleCondition {
    field: string;              // e.g., 'purchase.amount', 'attribution.source', 'user.is_new'
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'exists';
    value: any;
}

interface RewardDefinition {
    recipient: 'referrer' | 'referee' | 'buyer';
    type: 'token' | 'discount' | 'points' | 'coupon';
    
    // For token rewards
    amount?: number;
    token?: 'USDC' | 'ETH' | string;
    
    // For percentage-based rewards
    percent?: number;
    percentOf?: 'purchase_amount' | 'fixed';
    
    // For discount rewards
    unit?: 'percent' | 'fixed';
    
    // Caps
    maxAmount?: number;
}
```

#### Example Rules

**1. Basic Referral Reward**
```json
{
    "trigger": "purchase",
    "conditions": [
        { "field": "attribution.source", "operator": "eq", "value": "referral_link" }
    ],
    "rewards": [
        {
            "recipient": "referrer",
            "type": "token",
            "amount": 10,
            "token": "USDC"
        },
        {
            "recipient": "referee",
            "type": "discount",
            "amount": 5,
            "unit": "percent"
        }
    ]
}
```

**2. High-Value Purchase (No Attribution Required)**
```json
{
    "trigger": "purchase",
    "conditions": [
        { "field": "purchase.amount", "operator": "gte", "value": 50 },
        { "field": "attribution.source", "operator": "eq", "value": "direct" }
    ],
    "rewards": [
        {
            "recipient": "buyer",
            "type": "token",
            "percent": 2,
            "percentOf": "purchase_amount",
            "token": "USDC",
            "maxAmount": 20
        }
    ]
}
```

**3. Percentage-Based Referral**
```json
{
    "trigger": "purchase",
    "conditions": [
        { "field": "attribution.source", "operator": "eq", "value": "referral_link" },
        { "field": "purchase.amount", "operator": "gte", "value": 100 }
    ],
    "rewards": [
        {
            "recipient": "referrer",
            "type": "token",
            "percent": 10,
            "percentOf": "purchase_amount",
            "token": "USDC",
            "maxAmount": 50
        },
        {
            "recipient": "referee",
            "type": "points",
            "amount": 500
        }
    ]
}
```

#### Rule Evaluation Engine

```typescript
async function evaluateRules(event: PurchaseEvent, attribution: AttributionResult): Promise<Reward[]> {
    const rules = await db.query(`
        SELECT * FROM campaign_rules 
        WHERE merchant_id = $1 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY priority DESC
    `, [event.merchantId]);
    
    const rewards: Reward[] = [];
    
    for (const rule of rules) {
        // Check trigger
        if (!matchesTrigger(rule.rule.trigger, event, attribution)) continue;
        
        // Check all conditions
        const context = buildContext(event, attribution);
        if (!allConditionsMatch(rule.rule.conditions, context)) continue;
        
        // Check budget
        if (rule.budget && !await hasBudget(rule.id, rule.budget)) continue;
        
        // Calculate rewards
        for (const rewardDef of rule.rule.rewards) {
            const reward = calculateReward(rewardDef, event, attribution);
            if (reward) rewards.push(reward);
        }
    }
    
    return rewards;
}

function allConditionsMatch(conditions: RuleCondition[], context: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(cond => {
        const value = getNestedValue(context, cond.field);
        
        switch (cond.operator) {
            case 'eq': return value === cond.value;
            case 'neq': return value !== cond.value;
            case 'gt': return value > cond.value;
            case 'gte': return value >= cond.value;
            case 'lt': return value < cond.value;
            case 'lte': return value <= cond.value;
            case 'in': return cond.value.includes(value);
            case 'not_in': return !cond.value.includes(value);
            case 'exists': return value !== undefined && value !== null;
            default: return false;
        }
    });
}
```

### Extensibility

This JSON-based approach allows adding new capabilities without schema changes:

| Extension | How to Add |
|-----------|------------|
| New trigger type | Add to `trigger` union, update `matchesTrigger()` |
| New condition field | Add to context builder |
| New reward type | Add to `type` union, update `calculateReward()` |
| New operator | Add to `allConditionsMatch()` switch |
| Time-based rules | Add `schedule` field to rule JSON |
| Tiered rewards | Add `tiers` array to reward definition |

### Asset Ledger

```sql
CREATE TYPE asset_status AS ENUM (
    'pending',          -- Within refund window / awaiting clearance
    'ready',            -- Ready for distribution
    'ready_to_claim',   -- Pushed to blockchain, awaiting user claim
    'claimed',          -- User claimed on-chain
    'consumed',         -- Soft reward used (coupon redeemed)
    'expired',          -- Unclaimed past expiry
    'cancelled'         -- Refunded / disputed
);

CREATE TABLE asset_logs (
    id                  UUID PRIMARY KEY,
    identity_group_id   UUID NOT NULL REFERENCES identity_groups(id),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    campaign_rule_id    UUID REFERENCES campaign_rules(id),
    
    -- Asset details
    asset_type          TEXT NOT NULL,  -- 'token', 'discount', 'points', etc.
    amount              DECIMAL NOT NULL,
    currency            TEXT,  -- 'USDC', 'ETH', or coupon code
    
    -- Recipient type (for multi-recipient rewards)
    recipient_type      TEXT NOT NULL,  -- 'referrer', 'referee', 'buyer'
    
    -- Status tracking
    status              asset_status DEFAULT 'pending',
    status_changed_at   TIMESTAMPTZ DEFAULT NOW(),
    
    -- Full traceability: link to source events
    event_stream_ids    UUID[] NOT NULL DEFAULT '{}',
    /*
     * Array of event_stream IDs that led to this reward.
     * Enables:
     *   - "Show me which events triggered this reward"
     *   - "For this purchase event, what rewards were distributed?"
     *   - Dashboard stats: events → rewards correlation
     * 
     * One event can trigger multiple rewards (referrer + referee).
     * One reward is typically linked to one event (purchase), but
     * future scenarios might have multiple (e.g., purchase + milestone).
     */
    
    -- Attribution link
    touchpoint_id       UUID REFERENCES touchpoints(id),
    purchase_id         TEXT,           -- External reference (merchant order ID)
    
    -- Referrer wallet (for quick lookups without joining touchpoints)
    referrer_wallet     TEXT,           -- Denormalized from touchpoint.source_data
    
    -- Blockchain sync (for hard rewards)
    onchain_tx_hash     TEXT,
    onchain_block       BIGINT,
    
    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    claimable_at        TIMESTAMPTZ,  -- When status can flip to ready
    expires_at          TIMESTAMPTZ,
    
    INDEX idx_assets_group (identity_group_id),
    INDEX idx_assets_status (status),
    INDEX idx_assets_claimable (claimable_at) WHERE status = 'pending',
    INDEX idx_assets_referrer (referrer_wallet),
    INDEX idx_assets_events (event_stream_ids) USING GIN  -- For array queries
);
```

**Traceability**: The `event_stream_ids` array enables full audit trail:

```sql
-- "What events triggered rewards for this user?"
SELECT es.* 
FROM event_stream es
WHERE es.id = ANY(
    SELECT unnest(event_stream_ids) 
    FROM asset_logs 
    WHERE identity_group_id = $1
);

-- "For this purchase event, what rewards were created?"
SELECT al.* 
FROM asset_logs al
WHERE $1 = ANY(al.event_stream_ids);

-- Dashboard: "Rewards per event type"
SELECT es.event_type, COUNT(al.id), SUM(al.amount)
FROM asset_logs al
JOIN LATERAL unnest(al.event_stream_ids) AS eid ON true
JOIN event_stream es ON es.id = eid
GROUP BY es.event_type;
```

### Reward Calculation Flow

```
ON_PURCHASE(purchase_event):
    // 1. Resolve identity
    identity_group = resolve_or_create_identity(purchase_event)
    
    // 2. Attribute purchase
    attribution = ATTRIBUTE_PURCHASE(purchase_event)
    
    // 3. Validate attribution
    validation = VALIDATE_ATTRIBUTION(attribution, purchase_event)
    IF validation.rejected:
        LOG_FRAUD(validation.reason)
        attribution.attributed = false
    
    // 4. Find matching campaign rules
    rules = SELECT * FROM campaign_rules 
        WHERE merchant_id = purchase_event.merchant_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    
    // 5. Apply rules
    FOR rule IN rules:
        IF matches_trigger(rule, attribution):
            rewards = calculate_rewards(rule, purchase_event, attribution)
            
            FOR reward IN rewards:
                INSERT INTO asset_logs (
                    identity_group_id: reward.recipient_group,
                    merchant_id: purchase_event.merchant_id,
                    campaign_rule_id: rule.id,
                    asset_type: rule.reward_type,
                    amount: reward.amount,
                    status: 'pending',
                    touchpoint_id: attribution.touchpoint_id,
                    purchase_id: purchase_event.id,
                    claimable_at: NOW() + merchant.clearance_period
                )
```

---

## 7. Smart Contract Layer

### Design Philosophy

The new Vault contract is **intentionally simple**:

- No campaign logic on-chain
- No merchant identification in contract state
- Attestation objects carry context (future: ZKP-verified)
- Backend is source of truth, blockchain is settlement rail

### Vault Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFrakVault {
    struct Allocation {
        address recipient;
        uint256 amount;
        bytes32 attestationHash;  // Hash of off-chain attestation
    }
    
    /// @notice Batch set allocations for multiple recipients
    /// @param allocations Array of recipient allocations
    /// @param attestations Array of attestation data (ABI-encoded)
    function batchSetAllocation(
        Allocation[] calldata allocations,
        bytes[] calldata attestations
    ) external;
    
    /// @notice User claims their allocated rewards
    function claim() external;
    
    /// @notice Check pending allocation for an address
    function getPendingAmount(address recipient) external view returns (uint256);
    
    /// @notice Emitted when allocation is set
    event AllocationSet(address indexed recipient, uint256 amount, bytes32 attestationHash);
    
    /// @notice Emitted when user claims
    event Claimed(address indexed recipient, uint256 amount);
}
```

### Attestation Object

```typescript
interface RewardAttestation {
    // Public inputs (stored/verifiable)
    recipient: Address;
    amount: bigint;
    timestamp: number;
    
    // Context (ABI-encoded, hashed)
    interactionType: string;  // 'referral_purchase', 'direct_purchase', etc.
    merchantDomain: string;   // 'shop.example.com'
    
    // Future: ZKP proof
    proof?: {
        pi_a: [bigint, bigint];
        pi_b: [[bigint, bigint], [bigint, bigint]];
        pi_c: [bigint, bigint];
    };
}
```

### Settlement Worker

```typescript
// Runs daily (configurable)
async function settleRewards() {
    // 1. Fetch all READY rewards
    const readyRewards = await db.query(`
        SELECT 
            ig.wallet_address,
            SUM(al.amount) as total_amount,
            array_agg(al.id) as asset_log_ids
        FROM asset_logs al
        JOIN identity_groups ig ON al.identity_group_id = ig.id
        WHERE al.status = 'ready'
        AND al.asset_type IN ('cash_usdc', 'cash_eth')
        AND ig.wallet_address IS NOT NULL
        GROUP BY ig.wallet_address
    `);
    
    if (readyRewards.length === 0) return;
    
    // 2. Build allocations
    const allocations = readyRewards.map(r => ({
        recipient: r.wallet_address,
        amount: parseUnits(r.total_amount, 6),  // USDC decimals
        attestationHash: keccak256(buildAttestation(r))
    }));
    
    const attestations = readyRewards.map(r => 
        encodeAttestation(r)
    );
    
    // 3. Push to blockchain
    const tx = await vault.batchSetAllocation(allocations, attestations);
    await tx.wait();
    
    // 4. Update database
    for (const reward of readyRewards) {
        await db.query(`
            UPDATE asset_logs 
            SET status = 'ready_to_claim',
                onchain_tx_hash = $1,
                onchain_block = $2
            WHERE id = ANY($3)
        `, [tx.hash, tx.blockNumber, reward.asset_log_ids]);
    }
}
```

---

## 8. System Modules

### Module Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GATEKEEPER                                     │
│  Responsibility: Validate requests, decode JWTs, check HMAC signatures  │
│                                                                          │
│  • Webhook signature validation (Shopify, WooCommerce, Custom)          │
│  • SDK authentication (API key + session)                               │
│  • User authentication (Wallet signature)                               │
│  • Rate limiting                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        IDENTITY ENGINE                                   │
│  Responsibility: Resolve and merge identities                           │
│                                                                          │
│  • Anonymous ID (fingerprint) → Identity Group resolution               │
│  • Merchant Customer ID → Identity Group linking                        │
│  • Wallet connection → Anchor assignment                                │
│  • Merge operations with reward combination                             │
│  • OpenPanel identity synchronization                                   │
│  • Dispute handling                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       ATTRIBUTION JUDGE                                  │
│  Responsibility: Decide who gets credit                                 │
│                                                                          │
│  • Touchpoint recording (referral arrival, UTM tracking)                │
│  • Lookback window management                                           │
│  • Attribution rule evaluation                                          │
│  • Anti-fraud validation                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       CAMPAIGN ENGINE                                    │
│  Responsibility: Calculate rewards based on rules                       │
│                                                                          │
│  • Rule matching against attribution result                             │
│  • Reward calculation (percent/fixed, referrer/referee)                 │
│  • Budget enforcement                                                   │
│  • Clearance period management                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SETTLEMENT BRIDGE                                  │
│  Responsibility: Move rewards to blockchain                             │
│                                                                          │
│  • Soft reward instant distribution                                     │
│  • Hard reward batching                                                 │
│  • Blockchain sync (batchSetAllocation)                                 │
│  • Claim status tracking                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. User Journey

### Scenario: Alice (0xAlice) refers Bob (Anonymous)

```
Timeline:
─────────────────────────────────────────────────────────────────────────────►

T0: Bob clicks myshop.com?ref=0xAlice
    │
    │  SDK detects ?ref param
    │  SDK generates anonymous ID (fingerprint + merchantId)
    │  SDK calls POST /track/arrival with { anonId, ref }
    │
    ├─► Backend:
    │   1. Creates/finds Bob's identity group (anonymous fingerprint ID)
    │   2. Records touchpoint: { source: 'referral_link', referrer: '0xAlice' }
    │   3. Sets expiry: NOW() + 30 days
    │   4. Syncs identity to OpenPanel
    │
    └─► Response: { tracked: true, identityGroupId: 'uuid' }

T1: Bob browses, adds to cart
    │
    └─► Ignored by Frak (no high-value event)
        OpenPanel handles funnel analytics separately

T2: Bob purchases as guest (email: bob@email.com)
    │
    │  TWO parallel events trigger identity linking:
    │
    │  A) SDK 'Link Event' on Order Confirmation Page:
    │     │  Merchant's confirmation page includes Frak SDK
    │     │  SDK calls POST /identity/link-order with { anonId, orderId }
    │     │
    │     └─► Backend links Bob's anonId to the order for later correlation
    │
    │  B) Shopify webhook to POST /webhook/shopify:
    │     │  Contains order ID + customer email
    │     │
    │     └─► Backend matches order ID to the anonId from step A
    │
    │  (Alternative: Pre-checkout email capture triggers link event earlier)
    │
    ├─► Backend:
    │   1. Validates HMAC signature (webhook)
    │   2. Resolves identity: anonId → bob@email.com (Shopify customer) merge
    │      - Uses order ID as correlation key between SDK event and webhook
    │   3. ATTRIBUTE_PURCHASE:
    │      - Finds touchpoint from T0
    │      - Returns: { attributed: true, referrer: '0xAlice' }
    │   4. VALIDATE_ATTRIBUTION:
    │      - Self-referral? No (Bob has no wallet yet)
    │      - Velocity OK
    │      - Returns: VALID
    │   5. Apply campaign rules:
    │      - Rule: "Referrer gets 10%, Referee gets 5% cashback"
    │      - Purchase: $100
    │      - Referrer reward: $10 USDC → 0xAlice (status: pending)
    │      - Referee reward: $5 USDC → Bob's group (status: pending, no wallet)
    │
    └─► Response: 200 OK

T3: 14 days later (clearance period ends)
    │
    │  Settlement worker runs
    │
    ├─► Backend:
    │   1. Finds Alice's $10 reward (status: pending → ready)
    │   2. Bob's $5 stays pending (no wallet connected)
    │   3. Batches Alice's reward with others
    │   4. Calls vault.batchSetAllocation([{ 0xAlice, 10 USDC }])
    │   5. Updates: status = 'ready_to_claim', tx_hash = 0x...
    │
    └─► Alice can now claim on-chain

T4: Alice checks dashboard
    │
    │  GET /rewards/claimable?wallet=0xAlice
    │
    └─► Response: { claimable: [{ amount: 10, currency: 'USDC', status: 'ready_to_claim' }] }

T5: Alice claims
    │
    │  Alice calls vault.claim() from her wallet
    │
    ├─► Contract:
    │   1. Transfers 10 USDC to 0xAlice
    │   2. Emits Claimed(0xAlice, 10)
    │
    └─► Backend (indexer or event listener):
        Updates: status = 'claimed'

T6: Bob connects wallet (0xBob) weeks later
    │
    │  POST /identity/connect-wallet
    │
    ├─► Backend:
    │   1. Bob's identity group gets wallet anchor: 0xBob
    │   2. His $5 reward (pending) now has a claimable destination
    │   3. Next settlement batch will push to chain
    │
    └─► Bob can claim after next settlement
```

---

## 10. Migration Strategy

### Overview

Progressive migration from V1 (blockchain-centric) to V2 (web2-first):

```
Phase 1: Development
─────────────────────
• V2 built on dedicated branch (v2-hybrid-engine)
• New contracts deployed (Vault)
• Parallel development, no V1 disruption

Phase 2: Integration Testing
────────────────────────────
• Connect dashboard, wallet, SDK to V2 backend
• Dev environment only
• Test with synthetic merchants

Phase 3: Merchant Migration (Rolling)
─────────────────────────────────────
• Migrate merchants one-by-one in background job
• Convert V1 campaign rules → V2 campaign_rules table
• Import existing reward balances to asset_logs
• Merchants unaware (SDK on "latest" tag auto-updates)

Phase 4: Cutover
────────────────
• Brief downtime (20-30 min)
• Final data sync
• DNS/routing switch
• V1 enters read-only mode

Phase 5: Cleanup
────────────────
• Deprecate V1 endpoints
• Archive V1 data
• Remove V1 code
```

### SDK Migration

Since merchants use `@frak-labs/core-sdk@latest`:

1. SDK v2 maintains same public API surface
2. Internal calls route to V2 backend
3. `?ref=0xWallet` format unchanged
4. Breaking changes (if any) handled via feature flags

### Data Migration

```sql
-- Migrate V1 rewards to V2 asset_logs
INSERT INTO asset_logs (
    identity_group_id,
    merchant_id,
    asset_type,
    amount,
    status,
    created_at
)
SELECT 
    ig.id,
    pm.v2_merchant_id,
    'cash_usdc',
    r.amount,
    CASE 
        WHEN r.claimed THEN 'claimed'
        ELSE 'ready'
    END,
    r.created_at
FROM v1_rewards r
JOIN identity_groups ig ON ig.wallet_address = r.wallet
JOIN product_merchant_mapping pm ON pm.v1_product_id = r.product_id;
```

---

## 11. Critical Considerations

### Must Get Right

| Area | Risk | Mitigation |
|------|------|------------|
| **Anonymous ID Stability** | Browser updates may change fingerprint components | Store ID in localStorage after first generation; only regenerate if localStorage cleared |
| **Anonymous ID Collisions** | Two users with identical fingerprints on same merchant | Include timestamp of first visit in stored ID; accept low collision probability |
| **Identity Merge Logic** | Incorrect merges corrupt reward attribution | Extensive unit tests, audit trail, dispute mechanism |
| **Attribution Window Expiry** | Stale touchpoints cause incorrect attribution | Background job to clean expired touchpoints |
| **Self-Referral Detection** | Graph-based detection may have edge cases | Start strict, loosen with data |
| **Settlement Batching** | Failed batch leaves rewards in limbo | Idempotent retries, manual intervention tools |
| **Wallet-Less Rewards** | Users may never connect wallet | Expiry policy, notification nudges |
| **OpenPanel Sync** | Identity events may arrive out of order | Idempotent identity sync; use Frak anon ID as correlation key |
| **JSON Rule Validation** | Invalid rule JSON crashes evaluation | Schema validation on write; graceful skip on evaluation errors |
| **Guest Identity Gap** | Guest checkout breaks anonymous→purchase correlation (webhook has email, SDK has anon ID, no link between them) | SDK fires `POST /identity/link-order` on Order Confirmation Page with `{ anonId, orderId }`; backend correlates with webhook using Order ID as key |

### Security Considerations

1. **Webhook Validation**: Every webhook MUST validate HMAC signature
2. **Identity Linking**: Only allow identity merge during authenticated actions
3. **Reward Caps**: Enforce per-merchant, per-campaign, per-user limits
4. **Rate Limiting**: Aggressive limits on /track endpoints
5. **Attestation Integrity**: Hash all reward context, verify on-chain (future: ZKP)

### Performance Considerations

1. **Identity Resolution**: Cache hot identity groups (LRU)
2. **Touchpoint Queries**: Index on (identity_group_id, merchant_id, expires_at)
3. **Settlement Batching**: Process max 1000 allocations per transaction
4. **Event Bus**: Use internal TypedEventEmitter for domain decoupling

### Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Touchpoints | 90 days post-expiry | Audit trail |
| Asset Logs | Indefinite | Financial records |
| Identity Nodes | Until dispute/GDPR deletion | Core entity |
| Webhooks (raw) | 30 days | Debugging |

---

## 12. Phase 1 Deliverables

### Core Deliverables

| Component | Status | Description |
|-----------|--------|-------------|
| **Split-Brain Event System** | Required | Operational vs Analytical event separation |
| **Identity Graph** | Required | Anonymous fingerprint ID, merchant customer ID, wallet anchor |
| **P2P Referral Flow** | Required | Wallet address as referral code |
| **Global Merchant Rule** | Required | One fixed referral rule per merchant |
| **Touchpoint Recording** | Required | Referral arrival tracking |
| **Webhook Ingestion** | Required | Shopify, WooCommerce, Custom |
| **Reward Ledger** | Required | Pending/ready/claimed status tracking |
| **Vault Settlement** | Required | Batch push to blockchain |
| **OpenPanel Integration** | Required | Frak anon ID as identity source |

### Explicitly In Scope

- [x] Identity Graph (anonymous fingerprint ID + merchant customer ID + wallet)
- [x] P2P referral links (`?ref=0xWallet`)
- [x] Fixed global rule per merchant (referrer: X USDC, referee: Y% discount)
- [x] Split-brain event routing (operational → Postgres, analytical → OpenPanel)
- [x] Touchpoint tracking with 30-day lookback
- [x] Webhook ingestion (Shopify, WooCommerce, Custom)
- [x] Asset ledger with clearance periods
- [x] Vault contract with batch settlement
- [x] SDK v2 with fingerprint-based identity
- [x] Basic merchant dashboard (view rules, view rewards)

### Explicitly Out of Scope (Phase 2+)

| Feature | Reason for Deferral |
|---------|---------------------|
| Named referral codes (`summer_sale_24`) | Requires referral_links mapping table |
| Time-based multipliers | Requires campaign scheduling engine |
| Tiered rewards | Requires reward tier calculation logic |
| Multi-token rewards | Requires multi-token vault support |
| Browser extension identity | Requires extension development |
| ZKP attestations | Requires circuit development |
| Linear/multi-touch attribution | Requires credit splitting logic |
| Coupon/XP soft rewards | Requires coupon pool management |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Merchants onboarded** | 3+ | Count of active merchants |
| **Attributed purchases** | 1,000+ | Count of purchases with referral touchpoint |
| **Webhook latency** | < 500ms p99 | Time from webhook receipt to event stored |
| **Identity resolution** | < 50ms p99 | Time to resolve anon ID → identity group |
| **Settlement success** | > 99.9% | Batch transactions that succeed |
| **Zero reward errors** | 0 | Incorrect reward calculations |
| **Migration downtime** | < 30 min | V1 → V2 cutover window |

### Technical Validation Goals

Phase 1 proves these architectural decisions:

1. **Split-brain works**: OpenPanel can fail without impacting rewards
2. **Fingerprint IDs are stable**: Same browser returns same ID consistently
3. **P2P scales**: Wallet-as-code handles real merchant traffic
4. **JSON rules are flexible**: Can add new rule types without migrations
5. **Batch settlement is cost-effective**: Gas costs stay reasonable

---

**See [ARCHITECTURE-V2-APPENDIX.md](./ARCHITECTURE-V2-APPENDIX.md) for:**
- Appendix A: Glossary
- Appendix B: API Endpoints
- Appendix C: Event Types
- Appendix D: SDK Anonymous ID Implementation
- Appendix E: Rule Engine TypeScript Types
- Appendix F: Database Schema Summary

---

*Document will be updated as implementation progresses.*
