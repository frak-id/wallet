# Web2 Migration: Component Specifications

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Component Registry

| Component | Type | Status | Priority |
|-----------|------|--------|----------|
| Interaction Service | Backend Service | **New** | P0 |
| Campaign Engine | Backend Service | **New** | P0 |
| Reward Calculator | Backend Service | **New** | P0 |
| Referral Service | Backend Service | **New** | P0 |
| Batch Reward Pusher | Background Job | **New** | P0 |
| Product Service | Backend Service | **Modified** | P1 |
| ProductBank | Smart Contract | **New** | P0 |
| MultiTokenPushPull | Smart Contract | **New** | P0 |
| Ponder Indexer | Indexer | **Simplified** | P2 |

---

## 2. Backend Services

### 2.1 Interaction Service

**Purpose:** Receive, validate, and store user interactions from SDK and webhooks.

**Responsibilities:**
- Validate incoming interaction requests
- Correlate with OpenPanel session data when available
- Apply fallback tracking for adblocker scenarios (~5% of traffic)
- Deduplicate interactions within configurable time window
- Store interactions in PostgreSQL
- Trigger campaign evaluation

**Key Methods:**

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `pushInteraction` | productId, wallet, type, data, analytics IDs | interactionId | Process SDK interaction |
| `pushWebhookInteraction` | productId, webhookType, payload, signature | interactionId | Process webhook (Shopify, etc.) |
| `getInteractions` | wallet, filters | Interaction[] | Query interaction history |

**Configuration:**
- Deduplication window (default: 60 seconds)
- Rate limit per wallet per hour (default: 100)
- Fallback fingerprint TTL (default: 24 hours)

**Dependencies:**
- PostgreSQL (interactions table)
- Campaign Engine (triggers evaluation)
- OpenPanel API (session correlation, optional)

---

### 2.2 Campaign Engine

**Purpose:** Evaluate campaign rules and determine if interactions qualify for rewards.

**Responsibilities:**
- Match interactions to active campaigns
- Evaluate campaign conditions (trigger type, referral requirement, time bounds)
- Check budget availability
- Track per-user reward limits
- Queue rewards for distribution

**Key Methods:**

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `evaluateInteraction` | interaction | EvaluationResult | Match interaction to campaigns |
| `getActiveCampaigns` | productId | Campaign[] | Get active campaigns for product |
| `createCampaign` | campaignParams | Campaign | Create new campaign |
| `updateCampaign` | campaignId, updates | Campaign | Update existing campaign |
| `deactivateCampaign` | campaignId | void | Deactivate campaign |

**Campaign Matching Algorithm:**

```
1. Filter campaigns by:
   - productId matches
   - isActive = true
   - Current time within start/end dates

2. For each campaign, check:
   - Trigger type matches interaction type
   - If requiresReferral: user has referrer in interaction history
   - If maxRewardsPerUser set: user under limit
   - If budgetCap set: remaining budget > 0

3. If all checks pass:
   - Invoke Reward Calculator
   - Queue pending rewards
```

**Dependencies:**
- PostgreSQL (campaigns, interactions tables)
- Reward Calculator
- Referral Service

---

### 2.3 Reward Calculator

**Purpose:** Calculate reward amounts including referral chain distribution.

**Responsibilities:**
- Apply reward formulas (fixed or range)
- Build referral chains from interaction history
- Calculate per-recipient amounts with deperdition
- Respect budget constraints

**Key Methods:**

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `calculateRewards` | campaign, interaction, referralChain | CalculatedReward[] | Full reward calculation |
| `estimateRewards` | productId, interactionType, wallet | RewardEstimate | UI estimation |

**Reward Distribution Formula:**

```
Given:
- baseReward = 10 EUR
- userPercent = 50%
- deperditionPerLevel = 80%
- referralChain = [R1, R2, R3]

Distribution:
- User:    baseReward × userPercent = 5.00 EUR
- R1:      remaining × deperdition = 4.00 EUR
- R2:      remaining × deperdition = 0.80 EUR
- R3:      remaining (all left) = 0.20 EUR
- Total:   10.00 EUR ✓
```

**Dependencies:**
- Referral Service (chain computation)
- PostgreSQL (rewards table)

---

### 2.4 Referral Service

**Purpose:** Build and query referral relationships from interaction data.

**Responsibilities:**
- Extract referral relationships from `referral.referred` interactions
- Build referral chains with cycle detection
- Cache frequently accessed chains
- Provide efficient chain lookups

**Key Methods:**

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `getReferrer` | productId, wallet | Address or null | Get direct referrer |
| `getReferralChain` | productId, wallet, maxDepth | Address[] | Get full chain |
| `hasReferrer` | productId, wallet | boolean | Check if referred |

**Chain Computation Logic:**
- Query interactions table for `referral.referred` type
- Use `referrer_wallet` indexed column
- Recursive query up to maxDepth (default: 5)
- Detect and break cycles

**Dependencies:**
- PostgreSQL (interactions table)
- LRU cache for frequent lookups

---

### 2.5 Batch Reward Pusher

**Purpose:** Periodically push pending rewards to blockchain.

**Responsibilities:**
- Query pending rewards ready for push
- Group by product and token for efficient batching
- Sign reward batches with backend key
- Submit to ProductBank contracts
- Update reward status on success

**Execution:**
- Runs as cron job (every 5 minutes recommended)
- Processes up to N rewards per batch (configurable, default: 100)
- Groups rewards by (productId, tokenAddress)
- Stateless: failed pushes stay `pending`, picked up on next run

**Push Flow:**

```
1. Query rewards where:
   - status = 'pending'
   - created_at < (now - 1 minute)  // Avoid race conditions
   - GROUP BY token_address, wallet
   - LIMIT batch_size

2. For each (product, token) group:
   - Aggregate amounts per wallet
   - Generate unique nonce
   - Sign batch with EIP-712
   - Call ProductBank.pushRewards()

3. On success:
   - UPDATE rewards SET status = 'pushed', tx_hash = ?, pushed_at = NOW()

4. On failure:
   - Log error, do nothing (next run will retry)
   - If budget/funds issue: alert admin
```

**Design Rationale:**
- No retry counters or exponential backoff in database
- Stateless job - simply re-queries pending rewards each run
- Failed rewards remain `pending` and are automatically retried
- Simplifies both code and database schema

**Dependencies:**
- PostgreSQL (rewards table)
- ProductBank contracts (on-chain)
- Backend signing key

---

## 3. Smart Contracts

### 3.1 ProductBank

**Purpose:** Hold funds for a product, manage campaign budgets, authorize reward distribution.

**Deployment:** One per product

**Key Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(token, amount)` | Anyone | Deposit funds into bank |
| `withdraw(token, amount)` | Owner | Withdraw unused funds |
| `allocateCampaignBudget(campaignId, token, budget)` | Manager | Set campaign budget |
| `deactivateCampaign(campaignId)` | Manager | Stop campaign |
| `pushRewards(campaignId, token, rewards[], nonce, sig)` | Distributor | Push reward batch |

**Roles:**
- **Owner:** Product owner, can withdraw funds
- **Manager:** Can allocate budgets, deactivate campaigns
- **Distributor:** Backend signer, can push rewards

**Budget Logic:**
- `budget = 0`: Unlimited (uses available bank balance)
- `budget > 0`: Fixed cap, decremented on each push
- Reverts if push exceeds budget or available balance

**Security:**
- EIP-712 signatures for reward batches
- Nonce-based replay protection
- Reentrancy guards on all state changes

---

### 3.2 MultiTokenPushPull

**Purpose:** Token-agnostic reward claiming for all users.

**Deployment:** Single global instance

**Key Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `authorizePusher(address)` | Owner | Authorize a ProductBank |
| `revokePusher(address)` | Owner | Revoke authorization |
| `pushRewards(token, rewards[])` | Authorized Pusher | Add pending rewards |
| `pullReward(token)` | User | Claim single token |
| `pullRewards(tokens[])` | User | Claim multiple tokens |
| `getPendingAmount(token, user)` | View | Check pending balance |

**Storage:**
- `pendingAmounts[token][user]`: Pending amount per token per user
- `totalPending[token]`: Total pending per token (for accounting)
- `authorizedPushers[address]`: Whitelist of ProductBanks

**Events:**
- `RewardAdded(token, user, emitter, amount)` - Indexed by Ponder
- `RewardClaimed(token, user, amount)` - Indexed by Ponder

---

## 4. Ponder Indexer (Simplified)

**Purpose:** Index reward events for wallet UI display.

**Contracts Indexed:**
- MultiTokenPushPull only

**Events Indexed:**
- `RewardAdded` → Track pending rewards
- `RewardClaimed` → Track claim history

**Data Provided to Wallet:**
- Pending reward amounts per token
- Claim history with timestamps

**Removed from Current Indexer:**
- ProductRegistry events
- ReferralRegistry events
- ProductInteractionDiamond events
- Campaign contract events
- All interaction-related events

---

## 5. Frontend Changes

### 5.1 Wallet App

**Remove:**
- OpenSession component
- Session status indicators
- Session activation prompts in modals
- `useOpenSession` hook and related state

**Modify:**
- PendingReferral component → Query MultiTokenPushPull (multi-token)
- Modal flows → Remove session step from step ordering
- Wallet status → Remove interactionSession from display

**Keep Unchanged:**
- WebAuthn authentication
- Reward claiming UI (just different contract)
- Balance display

### 5.2 Business Dashboard

**Modify:**
- Campaign creation → Use new PostgreSQL-backed API
- Campaign list → Query PostgreSQL instead of MongoDB/indexer
- Campaign edit → Enable instant updates (no deployment)
- Analytics → Query PostgreSQL for interaction data

**Add:**
- Real-time budget tracking display
- Interaction analytics dashboard

---

## 6. SDK Changes

### 6.1 APIs to Remove

| API | Reason |
|-----|--------|
| `openSession()` | No longer needed |
| `closeSession()` | No longer needed |
| `getSessionStatus()` | No longer needed |

### 6.2 APIs to Simplify

| API | Change |
|-----|--------|
| `sendInteraction()` | Remove session check, always works if wallet connected |
| `watchWalletStatus()` | Remove `interactionSession` from return type |
| `displayModal()` | Remove `openSession` step from flow |

### 6.3 Backward Compatibility

- Deprecated APIs can return success immediately (no-op)
- Provide migration guide for partners
- Consider 1-2 month deprecation period

---

*Continue to [03-database-schema.md](./03-database-schema.md) for database schema specifications.*
