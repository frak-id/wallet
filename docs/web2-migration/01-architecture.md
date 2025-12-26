# Web2 Migration: Target Architecture

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Architecture Principles

### 1.1 Design Philosophy

| Principle | Application |
|-----------|-------------|
| **Web2 for flexibility** | Interactions, campaigns, business logic in PostgreSQL |
| **Web3 for trust** | Reward distribution on-chain for transparency |
| **Minimal blockchain footprint** | Only 3 contracts instead of 15+ |
| **Single source of truth** | PostgreSQL as primary, eliminate MongoDB |
| **Backward compatible claiming** | Users claim rewards the same way |

### 1.2 Separation of Concerns

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSIBILITY MAPPING                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   BACKEND OWNS:                        BLOCKCHAIN OWNS:                       │
│   ─────────────                        ────────────────                       │
│   • Interaction validation             • Fund custody                         │
│   • Campaign rules                     • Budget enforcement                   │
│   • Reward calculation                 • Reward distribution                  │
│   • Referral chain computation         • User claiming                        │
│   • Analytics & reporting              • Audit trail                          │
│   • Rate limiting                      • Signature verification               │
│   • Deduplication                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Layers

### 2.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: CLIENT                                                              │
│ Website (SDK) | Wallet App | Business Dashboard | Admin Dashboard            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: COMMUNICATION                                                       │
│ Listener (iframe) ←→ Backend API (Elysia.js)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: SERVICES                                                            │
│ Interaction Service | Campaign Engine | Reward Calculator | Referral Service│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: PERSISTENCE                                                         │
│ PostgreSQL (primary) | OpenPanel (analytics)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: BLOCKCHAIN                                                          │
│ ProductBank (per product) | MultiTokenPushPull (global) | Ponder (minimal)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Components | Responsibility | Changes |
|-------|------------|----------------|---------|
| Client | SDK, Apps | User interaction, display | Remove session UI/APIs |
| Communication | Listener, API | Secure bridging | Remove session validation |
| Services | Backend services | Business logic | **New** - all campaign/reward logic |
| Persistence | PostgreSQL | Data storage | **New** - migrate from MongoDB, add interactions |
| Blockchain | Contracts, Indexer | Rewards | **Simplified** - 3 contracts, minimal indexing |

---

## 3. Data Flow Diagrams

### 3.1 User Interaction Flow (Simplified)

**Current flow** (6+ steps, blockchain dependent):
```
SDK → Listener → Backend → Validate Session (on-chain) → Sign → Submit TX → 
Diamond → Facet → Campaign → Reward Distribution
```

**New flow** (3 steps, instant):
```
SDK → Listener → Backend → Store in PostgreSQL → Return success
                              ↓
                    (Async) Campaign Engine evaluates
                              ↓
                    (Async) Queue rewards for batch push
```

### 3.2 Reward Distribution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REWARD DISTRIBUTION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

    1. INTERACTION RECEIVED
       └── Backend stores in PostgreSQL

    2. CAMPAIGN EVALUATION (immediate)
       ├── Find matching active campaigns
       ├── Check: trigger type matches?
       ├── Check: user has referrer? (if required)
       ├── Check: user under reward limit?
       └── Check: campaign has budget?

    3. REWARD CALCULATION (if matched)
       ├── Get referral chain from interaction history
       ├── Apply user percent (e.g., 50%)
       ├── Apply deperdition per referral level (e.g., 80%)
       └── Queue pending rewards in PostgreSQL

    4. BATCH PUSH (every N minutes)
       ├── Group pending rewards by product + token
       ├── Sign batch with backend key
       ├── Call ProductBank.pushRewards()
       └── Mark rewards as pushed

    5. USER CLAIMING (unchanged)
       └── User calls MultiTokenPushPull.pullReward(token)
```

### 3.3 Campaign Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAMPAIGN MANAGEMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

    CURRENT:
    Dashboard → API → MongoDB → Deploy Contract → Wait for TX → 
    Attach to Diamond → Wait for TX → Active

    NEW:
    Dashboard → API → PostgreSQL → Active (instant)
                         ↓
              (If budget cap) Allocate on ProductBank
```

---

## 4. Component Interactions

### 4.1 Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE DEPENDENCY GRAPH                             │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │   Backend API       │
                         └──────────┬──────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
    ┌───────────┐           ┌───────────────┐          ┌───────────┐
    │Interaction│──────────▶│   Campaign    │          │  Product  │
    │ Service   │           │    Engine     │          │  Service  │
    └─────┬─────┘           └───────┬───────┘          └───────────┘
          │                         │
          │                         ▼
          │                 ┌───────────────┐
          └────────────────▶│   Referral    │
                            │   Service     │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │    Reward     │
                            │  Calculator   │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │ Pending Queue │
                            │  (PostgreSQL) │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  Batch Push   │
                            │     Job       │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  ProductBank  │
                            │  (on-chain)   │
                            └───────────────┘
```

### 4.2 API Dependency Matrix

| Consumer | Interaction Service | Campaign Engine | Referral Service | Product Service |
|----------|:------------------:|:---------------:|:----------------:|:---------------:|
| SDK/Listener | Creates | - | - | - |
| Interaction Service | - | Triggers | Queries | Validates |
| Campaign Engine | Queries | - | Uses | Queries |
| Reward Calculator | - | - | Uses | - |
| Business Dashboard | - | CRUD | - | CRUD |
| Batch Push Job | - | - | - | Gets bank address |

---

## 5. Smart Contract Architecture

### 5.1 Contract Overview

| Contract | Deployment | Purpose |
|----------|------------|---------|
| **ProductBank** | One per product | Holds funds, manages campaign budgets, authorizes reward pushes |
| **MultiTokenPushPull** | Single global instance | Token-agnostic pending amounts, user claiming |

### 5.2 Contract Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONTRACT INTERACTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

    PRODUCT OWNER                    BACKEND                        USER
         │                              │                            │
         │  deposit(token, amount)      │                            │
         │─────────────────────────────▶│                            │
         │         ProductBank          │                            │
         │                              │                            │
         │  allocateCampaignBudget()    │                            │
         │─────────────────────────────▶│                            │
         │                              │                            │
         │                              │                            │
         │                              │  pushRewards(batch, sig)   │
         │                              │───────────────────────────▶│
         │                              │       ProductBank          │
         │                              │            │               │
         │                              │            │ transfer +    │
         │                              │            │ pushRewards   │
         │                              │            ▼               │
         │                              │    MultiTokenPushPull      │
         │                              │                            │
         │                              │                       pullReward(token)
         │                              │◀───────────────────────────│
         │                              │    MultiTokenPushPull      │
         │                              │            │               │
         │                              │            │ transfer      │
         │                              │            └──────────────▶│
```

### 5.3 Contract Capabilities

**ProductBank:**
- Accept deposits from product owner
- Track campaign budgets (capped or unlimited)
- Verify backend signatures on reward batches
- Transfer tokens to MultiTokenPushPull
- Allow owner to withdraw unused funds

**MultiTokenPushPull:**
- Accept rewards from authorized ProductBanks
- Track pending amounts per (token, user)
- Allow users to claim any token
- Support batch claiming multiple tokens

---

## 6. Data Architecture

### 6.1 PostgreSQL Domains

| Domain | Tables | Purpose |
|--------|--------|---------|
| Products | products, product_banks, product_administrators | Product configuration, on-chain references |
| Campaigns | campaigns, campaign_user_rewards | Campaign definitions, per-user tracking |
| Interactions | interactions | All user events with indexed referral data |
| Rewards | rewards | Reward lifecycle (pending → pushed) |

### 6.2 Key Design Decisions

**Referrals via Indexed Interactions (not separate table):**
- `referral.referred` interaction type stores referrer in `referrer_wallet` column
- Referral chain computed by querying interaction history
- Simpler schema, single source of truth

**Multi-token Support:**
- ProductBank tracks balances per token
- Campaigns reference a ProductBank (not a specific token)
- Pending rewards include token address

**Campaign Budgets:**
- `budget_cap = 0` means unlimited (uses available bank balance)
- `budget_cap > 0` means fixed cap, tracked on-chain and in PostgreSQL
- Prevents over-distribution at both layers

---

## 7. Security Architecture

### 7.1 Security Layers

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| SDK → Listener | Origin validation | Prevent cross-site injection |
| Listener → Backend | WebAuthn signature | Authenticate wallet |
| Webhook → Backend | HMAC signature | Authenticate product |
| Backend → Blockchain | EIP-712 signature | Authorize reward push |
| Blockchain | Nonce + role checks | Prevent replay, enforce access |

### 7.2 Abuse Prevention

| Attack Vector | Prevention |
|---------------|------------|
| Duplicate interactions | Dedup key + time window |
| Self-referral | Check referrer ≠ referee |
| Referral loops | Cycle detection in chain computation |
| Reward manipulation | Backend calculates, not client-supplied |
| Replay attacks | Nonce-based signature verification |
| Budget exhaustion | Rate limiting + on-chain caps |

---

## 8. Indexer Architecture

### 8.1 Current vs Target

| Aspect | Current Ponder | Target Ponder |
|--------|----------------|---------------|
| Contracts indexed | 15+ | 2 |
| Events tracked | All ecosystem | RewardAdded, RewardClaimed only |
| Data purpose | Full analytics | Wallet UI only |
| Complexity | High | Minimal |

### 8.2 Indexed Data

**RewardAdded event:**
- token, user, emitter (ProductBank), amount
- Used to show pending rewards in wallet

**RewardClaimed event:**
- token, user, amount, timestamp
- Used to show claim history in wallet

---

## 9. Scalability Considerations

### 9.1 Bottleneck Analysis

| Component | Potential Issue | Mitigation |
|-----------|-----------------|------------|
| Interaction ingestion | High write volume | Batch inserts, async processing |
| Campaign evaluation | Complex queries | Caching, query optimization |
| Referral chain computation | Recursive queries | Limit depth (5), caching |
| Reward batch push | Blockchain TX throughput | Batching, scheduled pushes |

### 9.2 Capacity Targets

| Metric | Design Target |
|--------|---------------|
| Interactions/day | 1,000,000 |
| Reward pushes/day | 100,000 |
| Active products | 5,000 |
| Concurrent campaigns | 10,000 |

---

*Continue to [02-components.md](./02-components.md) for detailed component specifications.*
