# Web2 Migration: Backend Architecture

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Architecture Overview

### 1.1 Design Principles

| Principle | Application |
|-----------|-------------|
| **Domain-Driven Design** | One domain per business concept |
| **Context Pattern** | Namespace-based dependency injection |
| **Repository Pattern** | Data access abstraction with Drizzle ORM |
| **Service Layer** | Business logic encapsulation |
| **BFF APIs** | Consumer-specific API routes |

### 1.2 Domain Structure

```
services/backend/src/
├── domain/
│   ├── products/           # Product configuration & banks
│   ├── campaigns/          # Campaign definitions & engine
│   ├── rewards/            # Reward calculation & distribution
│   └── interactions/       # User interaction ingestion
├── jobs/
│   └── rewards/            # Background reward processing
└── api/
    ├── business/           # Dashboard APIs
    ├── wallet/             # Wallet app APIs
    └── external/           # SDK & webhook APIs
```

### 1.3 Domain Dependency Graph

```
┌──────────────────────────────────────────────────────────────────┐
│                     DOMAIN DEPENDENCIES                           │
└──────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ products │ ◄─────────────────────────┐
    └──────────┘                           │
         ▲                                 │
         │                                 │
    ┌──────────┐      ┌─────────┐    ┌─────────────┐
    │campaigns │ ◄────│ rewards │◄───│interactions │
    └──────────┘      └─────────┘    └─────────────┘

    Direction: Arrow points to dependency
    - interactions depends on products (validation)
    - rewards depends on campaigns (rules) and interactions (referral chains)
    - campaigns depends on products (ownership)
```

---

## 2. Domain: Products

### 2.1 Purpose

Manage product configuration, ProductBank contracts, and administrator access.

### 2.2 Structure

```
domain/products/
├── db/
│   └── schema.ts               # products, product_banks, product_administrators
├── repositories/
│   ├── ProductRepository.ts
│   ├── ProductBankRepository.ts
│   └── ProductAdminRepository.ts
├── services/
│   └── ProductService.ts
├── context.ts
└── index.ts
```

### 2.3 Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `ProductRepository` | CRUD for products table |
| `ProductBankRepository` | Track deployed ProductBank contracts per token |
| `ProductAdminRepository` | Role-based access control |
| `ProductService` | Validation, bank address resolution, admin checks |

### 2.4 Key Methods

```
ProductService:
├── getProduct(productId) → Product
├── getProductByDomain(domain) → Product
├── getProductBank(productId, token) → ProductBank
├── isAdmin(productId, wallet, role) → boolean
└── validateWebhookSignature(productId, payload, sig) → boolean
```

---

## 3. Domain: Campaigns

### 3.1 Purpose

Store campaign definitions and evaluate interactions against campaign rules.

### 3.2 Structure

```
domain/campaigns/
├── db/
│   └── schema.ts               # campaigns, campaign_user_rewards
├── repositories/
│   ├── CampaignRepository.ts
│   └── CampaignUserRewardsRepository.ts
├── services/
│   ├── CampaignService.ts      # CRUD operations
│   └── CampaignEngine.ts       # Rule evaluation
├── context.ts
└── index.ts
```

### 3.3 Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `CampaignRepository` | CRUD for campaigns table |
| `CampaignUserRewardsRepository` | Track per-user reward counts/limits |
| `CampaignService` | Create, update, activate, deactivate campaigns |
| `CampaignEngine` | Match interactions to campaigns, evaluate rules |

### 3.4 Key Methods

```
CampaignService:
├── createCampaign(params) → Campaign
├── updateCampaign(id, updates) → Campaign
├── activateCampaign(id) → Campaign
├── deactivateCampaign(id) → void
└── getActiveCampaigns(productId) → Campaign[]

CampaignEngine:
├── evaluateInteraction(interaction) → EvaluationResult
├── findMatchingCampaigns(productId, triggerType) → Campaign[]
├── checkUserEligibility(campaignId, wallet) → boolean
└── checkBudgetAvailability(campaignId, amount) → boolean
```

### 3.5 Campaign Matching Algorithm

```
evaluateInteraction(interaction):
    1. Find active campaigns for product
       └── Filter: status = 'active', within date range

    2. Filter by trigger type
       └── campaign.trigger_type === interaction.type

    3. For each matching campaign:
       a. Check referral requirement
          └── If requiresReferral: verify user has referrer
       b. Check user limits
          └── If maxRewardsPerUser: check campaign_user_rewards
       c. Check budget
          └── If budgetCap > 0: verify remaining >= estimated reward

    4. Return matched campaigns for reward calculation
```

---

## 4. Domain: Rewards

### 4.1 Purpose

Calculate rewards with referral chaining, manage reward lifecycle (pending → pushed).

### 4.2 Structure

```
domain/rewards/
├── db/
│   └── schema.ts               # rewards (single table)
├── repositories/
│   └── RewardRepository.ts     # CRUD + batch queries
├── services/
│   ├── ReferralService.ts      # Build referral chains
│   └── RewardCalculator.ts     # Compute reward amounts
├── context.ts
└── index.ts
```

### 4.3 Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `RewardRepository` | CRUD for rewards, batch queries for push job |
| `ReferralService` | Build referral chains from interaction history |
| `RewardCalculator` | Compute amounts with deperdition formula |

### 4.4 Key Methods

```
ReferralService:
├── getReferrer(productId, wallet) → Address | null
├── getReferralChain(productId, wallet, maxDepth) → Address[]
├── hasReferrer(productId, wallet) → boolean
└── detectCycle(productId, wallet, referrer) → boolean

RewardCalculator:
├── calculateRewards(campaign, interaction, chain) → CalculatedReward[]
├── estimateReward(campaign, hasReferrer) → RewardEstimate
└── applyDeperdition(baseAmount, level, config) → bigint
```

### 4.5 Reward Distribution Formula

```
Given:
  baseReward = campaign.base_reward
  userPercent = campaign.user_percent (basis points, e.g., 5000 = 50%)
  deperdition = campaign.deperdition_per_level (basis points, e.g., 8000 = 80%)
  chain = [R1, R2, R3]  // referrer addresses

Distribution:
  userAmount = baseReward × (userPercent / 10000)
  remaining = baseReward - userAmount

  For each referrer Ri at level i:
    if i < chain.length - 1:
      Ri.amount = remaining × (deperdition / 10000)
      remaining = remaining - Ri.amount
    else:
      Ri.amount = remaining  // Last referrer gets remainder

Example (baseReward = 10 EUR, userPercent = 50%, deperdition = 80%):
  User:  10 × 0.50 = 5.00 EUR
  R1:    5.00 × 0.80 = 4.00 EUR
  R2:    1.00 × 0.80 = 0.80 EUR
  R3:    0.20 (remainder) = 0.20 EUR
  Total: 10.00 EUR ✓
```

---

## 5. Domain: Interactions

### 5.1 Purpose

Receive, validate, and store user interactions from SDK and webhooks.

### 5.2 Structure

```
domain/interactions/
├── db/
│   └── schema.ts               # interactions
├── repositories/
│   └── InteractionRepository.ts
├── services/
│   └── InteractionService.ts
├── context.ts
└── index.ts
```

### 5.3 Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `InteractionRepository` | CRUD for interactions table, referral queries |
| `InteractionService` | Validate, deduplicate, store, trigger evaluation |

### 5.4 Key Methods

```
InteractionService:
├── pushInteraction(params) → Interaction
│   └── params: productId, wallet, type, data, analyticsIds
├── pushWebhookInteraction(params) → Interaction
│   └── params: productId, webhookType, payload, signature
├── getInteractions(wallet, filters) → Interaction[]
├── isDuplicate(productId, wallet, type, dedupKey) → boolean
└── correlateAnalytics(interaction, sessionId) → void
```

### 5.5 Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERACTION PROCESSING                        │
└─────────────────────────────────────────────────────────────────┘

    SDK/Webhook Request
           │
           ▼
    ┌─────────────┐
    │  Validate   │ ── Check product exists, wallet valid
    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │ Deduplicate │ ── Check (product, wallet, type, dedupKey) + time window
    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │   Store     │ ── Insert into interactions table
    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │  Evaluate   │ ── CampaignEngine.evaluateInteraction()
    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │   Queue     │ ── Insert into rewards table (status: pending)
    └─────────────┘
           │
           ▼
        Return
```

---

## 6. Background Jobs

### 6.1 Batch Reward Pusher

**Location**: `jobs/rewards/batchPush.ts`

**Purpose**: Periodically push accumulated pending rewards to blockchain.

**Schedule**: Every 5 minutes (configurable)

### 6.2 Structure

```
jobs/
└── rewards/
    ├── index.ts                # Elysia plugin registration
    └── batchPush.ts            # Job implementation
```

### 6.3 Job Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BATCH PUSH JOB                                │
└─────────────────────────────────────────────────────────────────┘

    1. Query pending rewards
       └── WHERE status = 'pending' AND created_at < (now - 1 min)
       └── GROUP BY token_address, wallet
       └── LIMIT batch_size (default: 100)

    2. For each (product, token) group:
       a. Aggregate amounts per wallet
       b. Get ProductBank address
       c. Generate unique nonce
       d. Build EIP-712 signature
       e. Call ProductBank.pushRewards(campaignId, token, rewards[], nonce, sig)

    3. On success:
       └── UPDATE rewards SET status = 'pushed', tx_hash = ?, pushed_at = NOW()

    4. On failure:
       └── Log error, do nothing (stays pending)
       └── Next run will automatically retry
       └── Alert admin if budget/funds issue
```

**Design Rationale:**
- Stateless job - no retry counters or exponential backoff in database
- Failed rewards remain `pending` and are automatically picked up next run
- Simplifies both code and schema

### 6.4 Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BATCH_INTERVAL_MS` | 300000 (5 min) | Job run frequency |
| `BATCH_SIZE` | 100 | Max rewards per batch |
| `COOLDOWN_SECONDS` | 60 | Min age before processing |

---

## 7. API Routes

### 7.1 Structure

```
api/
├── business/routes/
│   ├── products/
│   │   └── banks.ts            # ProductBank management
│   └── campaigns/
│       ├── index.ts            # Route registration
│       ├── crud.ts             # Create, update, list, get
│       └── analytics.ts        # Stats, performance
│
├── wallet/routes/
│   └── rewards/
│       └── index.ts            # Pending amounts, claim history
│
└── external/
    └── products/
        ├── interactions.ts     # SDK interaction endpoint
        └── webhooks/
            ├── shopify.ts      # Shopify webhook handler
            └── custom.ts       # Generic webhook handler
```

### 7.2 Key Endpoints

**Business Dashboard:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/business/campaigns` | Create campaign |
| GET | `/business/campaigns` | List campaigns for product |
| GET | `/business/campaigns/:id` | Get campaign details |
| PATCH | `/business/campaigns/:id` | Update campaign |
| POST | `/business/campaigns/:id/activate` | Activate campaign |
| POST | `/business/campaigns/:id/deactivate` | Deactivate campaign |
| GET | `/business/campaigns/:id/analytics` | Campaign stats |

**Wallet:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wallet/rewards/pending` | Get pending reward amounts |
| GET | `/wallet/rewards/history` | Get claim history |

**External (SDK/Webhooks):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/external/interactions` | Push SDK interaction |
| POST | `/external/webhooks/shopify` | Shopify order webhook |
| POST | `/external/webhooks/:productId` | Generic product webhook |

---

## 8. Context Pattern

### 8.1 Structure

Each domain exports a context namespace for dependency injection:

```typescript
// domain/rewards/context.ts
import { RewardRepository } from "./repositories/RewardRepository";
import { ReferralService } from "./services/ReferralService";
import { RewardCalculator } from "./services/RewardCalculator";

export namespace RewardsContext {
    // Repositories
    const rewardRepo = new RewardRepository();

    // Services (with dependencies)
    const referralService = new ReferralService();
    const rewardCalculator = new RewardCalculator(referralService);

    export const repositories = {
        reward: rewardRepo,
    };

    export const services = {
        referral: referralService,
        calculator: rewardCalculator,
    };
}
```

### 8.2 Usage

```typescript
// In API route or job
import { RewardsContext } from "@/domain/rewards";
import { CampaignsContext } from "@/domain/campaigns";

const rewards = await RewardsContext.services.calculator.calculateRewards(
    campaign,
    interaction,
    referralChain
);
```

---

## 9. Cross-Domain Communication

### 9.1 Interaction → Reward Flow

```typescript
// In InteractionService.pushInteraction()

// 1. Store interaction
const interaction = await InteractionsContext.repositories.interaction.create(params);

// 2. Evaluate campaigns
const result = await CampaignsContext.services.engine.evaluateInteraction(interaction);

// 3. Calculate and queue rewards for matched campaigns
for (const campaign of result.matchedCampaigns) {
    const chain = await RewardsContext.services.referral.getReferralChain(
        interaction.productId,
        interaction.wallet,
        campaign.maxReferralDepth
    );
    
    const rewards = RewardsContext.services.calculator.calculateRewards(
        campaign,
        interaction,
        chain
    );
    
    await RewardsContext.repositories.reward.createMany(rewards);
}
```

### 9.2 Dependency Rules

| Domain | Can Import From |
|--------|-----------------|
| `products` | None (leaf domain) |
| `campaigns` | `products` |
| `interactions` | `products` |
| `rewards` | `campaigns`, `interactions` |

---

## 10. File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Repository | `{Entity}Repository.ts` | `CampaignRepository.ts` |
| Service | `{Name}Service.ts` or `{Name}Engine.ts` | `CampaignEngine.ts` |
| Schema | `schema.ts` | `domain/campaigns/db/schema.ts` |
| Context | `context.ts` | `domain/campaigns/context.ts` |
| Index | `index.ts` | Re-exports public API |
| Job | `{action}.ts` | `batchPush.ts` |
| Route | `{resource}.ts` | `crud.ts`, `analytics.ts` |

---

*This architecture supports the migration plan in [05-implementation-plan.md](./05-implementation-plan.md). Implementation begins with domain scaffolding in Phase 1.*
