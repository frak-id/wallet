# Frak Backend V2: Refactoring Architecture

**Status**: Planning  
**Created**: 2026-01-07  
**Authors**: Frak Engineering

---

## Executive Summary

This document outlines a major refactoring of the Frak backend from a **blockchain-centric** architecture to a **web2-first with blockchain as settlement layer** approach. The refactor simplifies the system dramatically while opening new capabilities like anonymous user rewards.

### Why This Refactor?

| Current Pain Point | Root Cause | Solution |
|-------------------|------------|----------|
| Complex interaction flow | Every user action requires on-chain simulation and execution | Compute rewards offchain, settle in batches |
| No anonymous rewards | Rewards require wallet address upfront | Lock rewards by identityGroupId, resolve on wallet connect |
| Rigid campaign rules | Campaign logic encoded in smart contracts | JSON-based rule engine in PostgreSQL |
| Slow merchant onboarding | Contract deployments per product | Web2 merchant table, single shared RewardsHub |
| High gas costs | Per-interaction transactions | Batched settlement with attestations |
| Oracle complexity | Merkle trees for purchase proofs | Direct attestation with reward push |

### What Does This Enable?

1. **Anonymous Wallet Rewards**: User clicks referral link, makes purchase, reward locked. Creates wallet later → reward unlocked and claimable.
2. **Instant Attribution**: Referral tracking happens in milliseconds (database write) not seconds (blockchain confirmation).
3. **Flexible Campaigns**: Add new reward types, conditions, triggers without contract changes.
4. **Simpler Integration**: Merchants onboard via dashboard, no blockchain interaction required.
5. **Cost Efficiency**: Hourly batch settlement instead of per-purchase transactions.

---

## Core Philosophy Shift

```
BEFORE (Web3-Centric)
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  SDK → Backend → Simulate On-Chain → Sign → Execute On-Chain → Done    │
│                                                                         │
│  Every interaction = blockchain transaction                             │
│  Rewards calculated in smart contract                                  │
│  Merkle proofs for purchase verification                               │
│  Wallet required for everything                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

AFTER (Web2-First)
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  SDK → Backend → Store Event → Apply Rules → Compute Reward → Store    │
│                                          ↓                              │
│                              [Batch Job: Hourly Settlement]             │
│                                          ↓                              │
│                              batch() (unified push + lock)              │
│                                                                         │
│  Interactions = database writes                                         │
│  Rewards calculated in backend                                          │
│  Attestation replaces merkle proofs                                    │
│  Anonymous users supported via lock mechanism                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## New Domain Model

### 1. Merchant (Replaces "Product")

A **Merchant** represents a business entity using Frak for referral tracking.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              MERCHANT                                    │
│                                                                         │
│  id: UUID (primary key)                                                 │
│  productId: Hex (legacy, from ProductRegistry - for migration)         │
│  domain: string (unique, e.g., "shop.example.com")                      │
│  name: string                                                           │
│  bankAddress: Address (single bank, default token for V1)               │
│  config: JSON (webhook settings, SDK config, etc.)                      │
│  createdAt, updatedAt                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Changes from "Product"**:
- No longer requires blockchain registration to exist
- Single bank address per merchant with default token (V1)
- Future: Token mapping based on user's local currency (campaign rules, stablecoins only)
- Web2-first: merchant record in PostgreSQL is source of truth
- Blockchain is settlement layer only

**Migration Path**:
- Import all products from ProductRegistry (via indexer or direct contract read)
- Map productId → merchant UUID
- Pull campaign configurations from MongoDB
- Deploy single bank per merchant (or reuse existing if compatible)

### 2. Identity Graph

The **Identity Graph** resolves multiple identifiers to a single human entity.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IDENTITY GROUP                                 │
│                                                                         │
│  id: UUID (THE userId for lockReward)                                  │
│  walletAddress: Address | null (anchor, null until connected)          │
│  createdAt, updatedAt                                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     IDENTITY NODES                               │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │   │
│  │  │ anonymous_fp     │  │ merchant_customer│  │ wallet       │   │   │
│  │  │ merchant_a       │  │ merchant_a       │  │ (global)     │   │   │
│  │  │ anon_abc123...   │  │ cust_456789      │  │ 0xABC...     │   │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Identity Types**:

| Type | Scope | Source | Example |
|------|-------|--------|---------|
| `anonymous_fingerprint` | Per-merchant | SDK generates from browser fingerprint + merchantId | `anon_a1b2c3d4e5f6...` |
| `merchant_customer` | Per-merchant | Webhook (Shopify customer ID, email, etc.) | `shopify_123456789` |
| `wallet` | Global | Wallet connection | `0x1234...abcd` |

**Critical Rule**: One wallet per identity group. Wallet is the "anchor" - once set, it's the source of truth.

**Identity Resolution Flow**:

```
1. Anonymous User Arrives
   ├── SDK generates fingerprint-based anonymous ID
   ├── POST /user/identity/resolve { anonId, merchantId }
   └── Backend creates/returns identityGroupId

2. User Makes Purchase (Guest Checkout)
   ├── Webhook arrives with customer email/ID
   ├── SDK on order confirmation: POST /user/identity/link-order { anonId, orderId }
   └── Backend correlates: anonId → identityGroup ← merchantCustomerId

3. User Connects Wallet
   ├── POST /user/identity/connect-wallet { identityGroupId, wallet, signature }
   ├── Backend sets wallet as anchor on identity group
   ├── Backend calls: RewardsHub.resolveUserIds([{userId, wallet}])
   └── All locked rewards now assigned to wallet
```

### 3. Campaign Engine (Web2 Rule Engine) ✅ IMPLEMENTED

Campaigns define reward rules using a **JSON-based rule engine**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAMPAIGN RULE                                  │
│                                                                         │
│  id: UUID                                                               │
│  merchantId: UUID                                                       │
│  name: string                                                           │
│  priority: int (higher = evaluated first)                               │
│  rule: JSON {                                                           │
│      trigger: "purchase" | "referral_purchase" | "signup" | ...        │
│      conditions: [                                                      │
│          { field: "purchase.amount", operator: "gte", value: 50 }      │
│          { field: "attribution.source", operator: "eq", value: "..." } │
│      ]                                                                  │
│      rewards: [                                                         │
│          { recipient: "referrer", type: "token", amount: 10,           │
│            chaining: { userPercent: 20, deperditionPerLevel: 50 } }    │
│          { recipient: "referee", type: "token", percent: 5, ... }      │
│      ]                                                                  │
│  }                                                                      │
│  metadata: JSON { goal, specialCategories, territories }               │
│  budgetConfig: JSON [{ label, durationInSeconds, amount }, ...]        │
│  budgetUsed: JSON { [label]: { resetAt?, used } }                      │
│  expiresAt: timestamp | null                                            │
│  deactivatedAt: timestamp | null                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Reward Types**:

| Type | Description | Settlement |
|------|-------------|------------|
| `fixed` | Fixed amount (e.g., 10 USDC) | On-chain via RewardsHub |
| `percentage` | % of purchase amount | On-chain via RewardsHub |
| `tiered` | Amount based on thresholds | On-chain via RewardsHub |
| `range` | Beta distribution (min/max multiplier) | On-chain via RewardsHub |
| `discount` | Store discount | Soft reward, consumed at checkout |
| `points` | Loyalty points | Soft reward, tracked in database |

**Recipients**:
- `referrer`: The user who shared the link (with optional chaining for multi-level)
- `referee`: The user who clicked and converted (may be anonymous)
- `user`: The current user (for any non-referral rewards)

**Condition Operators** (13 total):
- Equality: `eq`, `neq`
- Comparison: `gt`, `gte`, `lt`, `lte`, `between`
- Array: `in`, `not_in`
- String: `contains`, `starts_with`, `ends_with`
- Null: `exists`, `not_exists`

**Budget Enforcement**:
- **Flexible time periods**: hourly, daily, weekly, monthly, or custom duration
- **Real-time**: Budget checked and decremented atomically during reward creation
- **Strict**: Cannot exceed budget by a single cent
- **Inline reset**: No cron needed - reset happens on consumption if period expired
- If budget exceeded → reward not created, event still logged for analytics

### 3.1 Reward Chaining (Multi-Level Referrals)

When `recipient === "referrer"` with `chaining` config:

```
Total: 100 USDC | userPercent: 20% | deperditionPerLevel: 50%

Chain: C (buyer) → B (referrer) → A (referrer)

Distribution:
├─ C (referee):  20 USDC (20% of 100)      chainDepth: 0
├─ B (referrer): 40 USDC (50% of 80)       chainDepth: 1
└─ A (referrer): 40 USDC (remaining)       chainDepth: 2
```

### 3.2 Referral Links (Permanent Relationship Graph)

Separate from touchpoints (30-day attribution), referral links are permanent:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          REFERRAL LINK                                   │
│                                                                         │
│  id: UUID                                                               │
│  merchantId: UUID                                                       │
│  referrerIdentityGroupId: UUID (who shared)                            │
│  refereeIdentityGroupId: UUID (who clicked)                            │
│  createdAt: timestamp                                                   │
│                                                                         │
│  UNIQUE(merchantId, refereeIdentityGroupId) → First referrer wins      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Used for chain traversal in reward chaining. Created automatically when recording referral touchpoints.

### 4. Interaction Logs (Replacing Web3 Interactions)

All user events flow through a unified **interaction log**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERACTION LOG                                  │
│                                                                         │
│  id: UUID                                                               │
│  type: enum (see below)                                                 │
│  identityGroupId: UUID                                                  │
│  merchantId: UUID                                                       │
│  payload: JSON (event-specific data)                                    │
│  processedAt: timestamp | null                                          │
│  resultingRewardIds: UUID[] (links to asset_logs)                      │
│  createdAt: timestamp                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Interaction Types**:

| Type | Trigger | Contains |
|------|---------|----------|
| `referral_arrival` | User lands via `?ref=0xWallet` | referrerWallet, landingUrl |
| `purchase` | Webhook from merchant | orderId, amount, currency, items |
| `wallet_connect` | User links wallet | wallet, signature |
| `identity_merge` | Two identity groups combine | sourceGroupId, targetGroupId |

**Processing Flow**:

```
1. Event Received (SDK or Webhook)
   │
   ├── Validate & store in interaction_logs
   │
   ├── Resolve identity (find/create identity group)
   │
   ├── For purchase events:
   │   ├── Run attribution (find touchpoint)
   │   ├── Apply campaign rules
   │   ├── Check budget (real-time, strict - cannot exceed by a cent)
   │   ├── Calculate rewards (only if budget allows)
   │   └── Create asset_logs entries (status: pending)
   │
   └── Mark interaction as processed

2. Settlement Job (daily or configured frequency)
   │
   ├── Fetch all pending rewards
   ├── Group by: has wallet vs anonymous
├── batch() with unified push + lock operations (sorted by bank, token)
   └── Update status: pending → ready_to_claim
```

### 5. Reward Ledger (Asset Logs)

The **asset log** tracks all rewards from creation to claim.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            ASSET LOG                                     │
│                                                                         │
│  id: UUID                                                               │
│  identityGroupId: UUID                                                  │
│  merchantId: UUID                                                       │
│  campaignRuleId: UUID                                                   │
│                                                                         │
│  assetType: "token" | "discount" | "points"                            │
│  amount: decimal                                                        │
│  token: Address (for crypto rewards)                                    │
│                                                                         │
│  recipientType: "referrer" | "referee" | "buyer"                       │
│  referrerWallet: Address | null (denormalized for quick lookups)       │
│                                                                         │
│  status: enum (see state machine below)                                │
│  statusChangedAt: timestamp                                             │
│                                                                         │
│  touchpointId: UUID (which click led to this)                          │
│  purchaseId: string (merchant order reference)                          │
│  interactionLogId: UUID (which event triggered this)                   │
│                                                                         │
│  onchainTxHash: string | null                                          │
│  onchainBlock: bigint | null                                           │
│                                                                         │
│  createdAt: timestamp                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Reward State Machine**:

```
┌──────────┐                 ┌─────────────────┐
│  PENDING │ ───────────────►│ READY_TO_CLAIM  │
│ (created)│  settlement     │   (on-chain)    │
└──────────┘     job         └────────┬────────┘
     │                                │
     │                                │ user claims
     │                                ▼
     │                       ┌─────────────────┐
     │                       │    CLAIMED      │
     │                       │                 │
     │                       └─────────────────┘
     │
     ▼
┌─────────────────┐
│   CANCELLED     │
│ (refund/fraud)  │
└─────────────────┘
```

**Status Meanings**:

| Status | Description | Wallet Required? |
|--------|-------------|------------------|
| `pending` | Reward created, waiting for settlement batch | No |
| `ready_to_claim` | Pushed to blockchain, user can claim | Yes (or locked by userId) |
| `claimed` | User claimed on-chain | Yes |
| `consumed` | Soft reward used (discount redeemed) | No |
| `cancelled` | Refunded or fraud detected | - |

> **Note**: No clearance period in V1. Rewards go directly from `pending` to `ready_to_claim` in the next settlement batch. Clearance can be added later if needed.

---

## Smart Contract Interface

### RewardsHub Contract

Single contract for all reward settlement. Replaces per-product interaction contracts.

**Core Structs:**
```solidity
struct RewardOp {
    bool isLock;        // true = lock to userId, false = push to wallet
    bytes32 target;     // userId (if lock) or address padded to bytes32 (if push)
    uint256 amount;
    address token;
    address bank;       // merchant's bank (source of funds)
    bytes attestation;  // proof of legitimate reward
}

struct ResolveOp {
    bytes32 userId;
    address wallet;
}
```

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REWARDS HUB                                    │
│                                                                         │
│  Core Functions:                                                         │
│                                                                         │
│  // Unified batch for push + lock (gas optimized)                       │
│  batch(RewardOp[] calldata _ops)                                        │
│    - isLock=false: push to wallet (target = padded address)            │
│    - isLock=true: lock for userId (target = userId bytes32)            │
│    - SORT by (bank, token) for optimal gas!                            │
│                                                                         │
│  // Batch resolve userIds to wallets                                    │
│  resolveUserIds(ResolveOp[] calldata _ops)                             │
│                                                                         │
│  // Single operations (convenience, uses batch internally)              │
│  pushReward(wallet, amount, token, bank, attestation)                  │
│  lockReward(userId, amount, token, bank, attestation)                  │
│                                                                         │
│  // User claims their available rewards                                 │
│  claim(token)                                                           │
│  claimBatch(tokens[])                                                   │
│                                                                         │
│  // View functions                                                       │
│  getClaimable(wallet, token) returns uint256                           │
│  getLocked(userId, token) returns uint256                              │
│  getLockedTokens(userId) returns address[]                             │
│  getResolution(userId) returns address                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Gas Optimization:**
Operations SHOULD be sorted by `(bank, token)` for optimal gas usage. The contract aggregates consecutive operations with the same `(bank, token)` pair into a single transfer. Unsorted operations still work but may consume more gas.

**Under the Hood:**

```
batch(_ops):
    1. Verify caller has REWARDER_ROLE
    2. For each op (sorted by bank, token for efficiency):
       - If isLock=false: credit wallet (target as address) in claimable ledger
       - If isLock=true: credit userId (target) in locked ledger
    3. Aggregate transfers by (bank, token) pair
    4. Execute batched transfers from banks
    5. Emit RewardPushed/RewardLocked events

resolveUserIds(_ops):
    1. Verify caller has RESOLVER_ROLE
    2. For each op:
       - Move all locked balances from userId → wallet
       - Store resolution mapping
    3. Emit UserIdResolved events

claim(token):
    1. Get caller's claimable balance for token
    2. Transfer tokens to caller
    3. Clear balance
    4. Emit RewardClaimed

**Authorization**: 
- batch() requires REWARDER_ROLE
- resolveUserIds() requires RESOLVER_ROLE
- Both managed via `adminWalletsRepository` with the `rewarder` backend key
```

### Attestation Structure

For V1, attestation is a minified event log. Keep it simple, expandable to ZKP later.

```typescript
// V1: Simple event log format
type RewardAttestation = Array<{
    event: string;           // Event identifier (e.g., "purchase", "referral")
    timestampInSecond: number;
}>;

// Example:
// [
//   { event: "referral_arrival", timestampInSecond: 1704672000 },
//   { event: "purchase", timestampInSecond: 1704758400 }
// ]

// Encoded as: JSON.stringify(attestation) → base64 for on-chain storage
```

> **Future**: Add ZKP proof field, signature verification, etc. For now, attestation is informational only - the backend is the trusted authority.

---

## Data Flow Diagrams

### Flow 1: Referral with Known Wallet (Happy Path)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Alice     │         │     Bob     │         │   Merchant  │
│ (Referrer)  │         │  (Referee)  │         │   Website   │
│ 0xAlice     │         │ (anonymous) │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Share link        │                       │
       │  shop.com?ref=0xAlice │                       │
       │  ─────────────────────┼──────────────────────►│
       │                       │                       │
       │                       │  2. Click link        │
       │                       │  ─────────────────────►
       │                       │                       │
       │                       │         ┌─────────────────────────────┐
       │                       │         │ SDK: POST /user/track/arrival│
       │                       │         │ { anonId, ref: 0xAlice }    │
       │                       │         │                             │
       │                       │         │ Backend:                    │
       │                       │         │ - Create identityGroup      │
       │                       │         │ - Store touchpoint          │
       │                       │         │   (referrer: 0xAlice)       │
       │                       │         └─────────────────────────────┘
       │                       │                       │
       │                       │  3. Purchase          │
       │                       │  ─────────────────────►
       │                       │                       │
       │                       │         ┌─────────────────────────────┐
       │                       │         │ Webhook: POST /webhook/...  │
       │                       │         │ { orderId, amount, ... }    │
       │                       │         │                             │
       │                       │         │ Backend:                    │
       │                       │         │ - Link order to identityGrp │
       │                       │         │ - Run attribution           │
       │                       │         │   → finds 0xAlice touchpnt  │
       │                       │         │ - Apply campaign rules      │
       │                       │         │ - Create rewards:           │
       │                       │         │   Alice: 10 USDC (pending)  │
       │                       │         │   Bob: 5 USDC (pending)     │
       │                       │         └─────────────────────────────┘
       │                       │                       │
       │                       │                       │
       │  ═══════════════════════════════════════════════════════════
       │                    [Next settlement batch (hourly)]
       │  ═══════════════════════════════════════════════════════════
       │                       │                       │
       │         ┌─────────────────────────────────────────────────────┐
       │         │ Settlement Job (uses `rewarder` key):               │
       │         │ - Alice reward: PENDING → push to 0xAlice           │
       │         │ - Bob reward: PENDING → lock by identityGroupId    │
       │         │                                                     │
│         │ RewardsHub.batch([                                  │
│         │   {isLock:false, target:0xAlice, 10, USDC, bank},  │
│         │   {isLock:true, target:bobGroupId, 5, USDC, bank}  │
│         │ ])                                                  │
       │         └─────────────────────────────────────────────────────┘
       │                       │                       │
       │  4. Claim             │                       │
       │  RewardsHub.claim()   │                       │
       │                       │                       │
       ▼                       ▼                       ▼
```

### Flow 2: Anonymous User Connects Wallet Later

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BOB'S JOURNEY                                    │
└─────────────────────────────────────────────────────────────────────────┘

T0: Click referral link (anonymous)
    │
    │  SDK generates: anonId = hash(fingerprint + merchantId)
    │  Backend creates: identityGroup { id: "grp_abc", wallet: null }
    │  Backend stores: touchpoint { referrer: 0xAlice, groupId: "grp_abc" }
    │
    ▼

T1: Purchase as guest (email: bob@email.com)
    │
    │  Webhook arrives with: { customerId: "shop_123", email: "bob@..." }
    │  SDK on confirmation: POST /user/identity/link-order { anonId, orderId }
    │  Backend links: merchantCustomerId "shop_123" → identityGroup "grp_abc"
    │  
    │  Attribution finds touchpoint from T0
    │  Budget check: OK (real-time, strict)
    │  Campaign rule creates: reward { 5 USDC, status: pending }
    │
    ▼

T2: Next settlement batch (hourly)
    │
    │  Settlement job (uses `rewarder` key):
    │  - Bob has no wallet in identityGroup
    │  - Cannot push to wallet
    │  - Call: RewardsHub.batch([{isLock:true, "grp_abc", 5, USDC, bank, att}])
    │  - Reward status: pending → ready_to_claim (locked)
    │
    ▼

T3: Bob connects wallet (weeks later)
    │
    │  POST /user/identity/connect-wallet { groupId: "grp_abc", wallet: 0xBob }
    │  
    │  Backend:
    │  - Update identityGroup: wallet = 0xBob
    │  - Call: RewardsHub.resolveUserIds([{userId:"grp_abc", wallet:0xBob}])
    │  
    │  Contract:
    │  - Move locked balance from "grp_abc" → 0xBob
    │  - Bob can now claim
    │
    ▼

T4: Bob claims
    │
    │  RewardsHub.claim() from 0xBob
    │  5 USDC transferred to Bob
    │
    ▼
    Done!
```

### Flow 3: Multiple Identifiers Merging

```
Scenario: Bob uses different devices/browsers

Device A (Chrome):           Device B (Safari):
anonId = "anon_chrome_123"   anonId = "anon_safari_456"
        │                            │
        │                            │
        ▼                            ▼
identityGroup "grp_A"        identityGroup "grp_B"
wallet: null                 wallet: null
rewards: [5 USDC]            rewards: [3 USDC]


When Bob connects wallet 0xBob on Device A:
─────────────────────────────────────────────

1. POST /user/identity/connect-wallet { groupId: "grp_A", wallet: 0xBob }

2. Backend checks: does any other group have 0xBob?
   - No → set grp_A.wallet = 0xBob
   - Yes → merge groups (see below)

3. RewardsHub.resolveUserIds([{userId:"grp_A", wallet:0xBob}])


Later, Bob connects same wallet on Device B:
────────────────────────────────────────────

1. POST /user/identity/connect-wallet { groupId: "grp_B", wallet: 0xBob }

2. Backend checks: does any other group have 0xBob?
   - Yes! grp_A already has 0xBob

3. MERGE OPERATION:
   - grp_A is anchor (already has wallet)
   - Move all identity nodes from grp_B → grp_A
   - Move all rewards from grp_B → grp_A
   - RewardsHub.resolveUserIds([{userId:"grp_B", wallet:0xBob}]) to unlock grp_B rewards
   - Delete grp_B

4. Result:
   identityGroup "grp_A"
   wallet: 0xBob
   nodes: [anon_chrome_123, anon_safari_456]
   rewards: [5 USDC + 3 USDC = 8 USDC total]
```

---

## What Gets Deleted

### Removed from Backend

| Component | Reason |
|-----------|--------|
| `interactions_pending` table | No more blockchain interaction queue |
| `interactions_pushed` table | No more transaction tracking |
| `interactions_archived` table | No more failed interaction history |
| `backend_interactions_tracker` table | Replaced by interaction_logs |
| `interactionsPurchaseTrackerTable` | Merged into interaction_logs |
| Interaction simulation jobs | No on-chain simulation needed |
| Interaction execution jobs | Replaced by settlement batch |
| InteractionSignerRepository | No more transaction signing |
| InteractionPackerRepository | No more interaction encoding |
| CampaignDataRepository (on-chain reads) | Campaign rules in PostgreSQL |
| Merkle tree system | Attestations replace proofs |
| Oracle sync jobs | Direct push via RewardsHub |

### Kept (Modified)

| Component | Modification |
|-----------|--------------|
| `product_oracle_purchase` | Rename to `purchases`, link to interaction_logs |
| `product_oracle_purchase_item` | Keep for purchase details |
| WebAuthn authentication | Keep as-is |
| Device pairing | Keep as-is |
| Push notifications | Keep as-is |

### SDK Changes

| Current | New |
|---------|-----|
| Interaction signing | Removed - no signatures needed |
| On-chain interaction data encoding | Removed |
| Complex handshake for rewards | Simple event tracking |
| Wallet required for everything | Anonymous ID for tracking |

---

## Database Schema Changes

### New Tables

```sql
-- Merchant (replaces on-chain product concept)
CREATE TABLE merchants (
    id UUID PRIMARY KEY,
    product_id BYTEA UNIQUE,        -- Legacy hex, for migration
    domain TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bank_address BYTEA,             -- Single bank per merchant
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Rules (web2 rule engine)
CREATE TABLE campaign_rules (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id),
    name TEXT NOT NULL,
    priority INT NOT NULL,
    rule JSONB NOT NULL,            -- { trigger, conditions, rewards }
    budget JSONB,                   -- { daily, total, currency }
    budget_used_today NUMERIC DEFAULT 0,  -- Real-time daily tracking
    budget_used_total NUMERIC DEFAULT 0,  -- Real-time total tracking
    budget_reset_at TIMESTAMPTZ,    -- Last daily reset timestamp
    expires_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Budget enforcement is STRICT and REAL-TIME. 
-- Cannot exceed budget by a single cent.

-- Identity Graph
CREATE TABLE identity_groups (
    id UUID PRIMARY KEY,
    wallet_address BYTEA UNIQUE,    -- Anchor, null until connected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE identity_nodes (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES identity_groups(id) ON DELETE CASCADE,
    identity_type TEXT NOT NULL,    -- anonymous_fingerprint, merchant_customer, wallet
    identity_value TEXT NOT NULL,
    merchant_id UUID,               -- NULL for wallet (global)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identity_type, identity_value, merchant_id)
);

-- Touchpoints (attribution tracking)
CREATE TABLE touchpoints (
    id UUID PRIMARY KEY,
    identity_group_id UUID REFERENCES identity_groups(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    source TEXT NOT NULL,           -- referral_link, organic, paid_ad, etc.
    source_data JSONB NOT NULL,     -- { referrer_wallet, utm_*, etc. }
    landing_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ          -- Lookback window expiry
);

-- Interaction Logs (unified event stream)
CREATE TABLE interaction_logs (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL,             -- referral_arrival, purchase, wallet_connect, etc.
    identity_group_id UUID REFERENCES identity_groups(id),
    merchant_id UUID,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Ledger (rewards)
CREATE TABLE asset_logs (
    id UUID PRIMARY KEY,
    identity_group_id UUID REFERENCES identity_groups(id),
    merchant_id UUID NOT NULL,
    campaign_rule_id UUID REFERENCES campaign_rules(id),
    
    asset_type TEXT NOT NULL,       -- token, discount, points
    amount NUMERIC NOT NULL,
    token_address BYTEA,            -- For crypto rewards
    
    recipient_type TEXT NOT NULL,   -- referrer, referee, buyer
    referrer_wallet BYTEA,          -- Denormalized for lookups
    
    status TEXT NOT NULL DEFAULT 'pending',
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    touchpoint_id UUID REFERENCES touchpoints(id),
    purchase_id TEXT,
    interaction_log_id UUID REFERENCES interaction_logs(id),
    
    onchain_tx_hash TEXT,
    onchain_block BIGINT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: No clearance period in V1. Rewards settle in next batch.
```

---

## Long-Term Possibilities

This architecture opens doors to future capabilities:

### Phase 2+

| Feature | How It's Enabled |
|---------|------------------|
| **Named referral codes** | `code_mappings` table: `summer2025` → `0xAlice` |
| **Time-based multipliers** | Campaign rule conditions: `{ field: "time.dayOfWeek", op: "in", value: [6,7] }` |
| **Tiered rewards** | Campaign rules with multiple condition brackets |
| **Multi-token rewards** | Token mapping by user currency in campaign rules (stablecoins) |
| **Linear attribution** | Split credit across touchpoints in asset_logs |
| **ZKP attestations** | Extend attestation structure with proof field |

### Analytics & Insights

| Capability | Source |
|------------|--------|
| Attribution funnel | touchpoints + interaction_logs |
| Conversion by source | touchpoints.source analysis |
| Campaign ROI | campaign_rules + asset_logs aggregation |
| Identity merge rates | identity_groups + identity_nodes |
| Reward velocity | asset_logs status transitions |

### Potential Future Touchpoints

From the original V2 document, these become possible:

- Browser extension tracking
- QR code campaigns
- Email click tracking
- Cross-device identity bridging
- In-app browser identity merging

---

## Migration Considerations

### Data Migration

1. **Products → Merchants**
   - Read all products from ProductRegistry (via indexer)
   - Create merchant record for each
   - Preserve productId for backwards compatibility

2. **Campaigns**
   - Read campaign configurations from MongoDB
   - Convert to JSON rule format
   - Validate against new schema

3. **Existing Rewards**
   - Query indexer for unclaimed rewards per wallet
   - Create asset_logs entries with status `ready_to_claim`
   - Ensure on-chain balances match

### Breaking Changes

| Area | Impact |
|------|--------|
| SDK | Complete rewrite of interaction layer |
| Wallet App | New reward claiming flow via RewardsHub |
| Business Dashboard | New campaign management UI |
| Webhook format | Potential changes to payload structure |

### Rollout Strategy

See `REFACTO_PLAN.md` for detailed phased rollout.

---

*This document will be updated as implementation progresses.*
