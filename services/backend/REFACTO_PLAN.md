# Frak Backend V2: Refactoring Plan

**Status**: Planning  
**Created**: 2026-01-07  
**Authors**: Frak Engineering

---

## Overview

This document outlines the step-by-step plan to refactor the Frak backend from web3-centric to web2-first architecture. The refactor happens **in-place** within `services/backend/` - we are NOT creating a separate service.

### Guiding Principles

1. **KISS**: Start simple, iterate. Don't over-engineer.
2. **Incremental**: Each phase delivers working functionality.
3. **No Parallel Systems**: Replace, don't duplicate.
4. **Breaking Changes OK**: New SDK, new wallet app, new contracts.

### High-Level Phases

```
Phase 0: Foundation & Cleanup
    └── Remove dead code, prepare database
    
Phase 1: Merchant Domain (Web2)
    └── Merchant table, migration from ProductRegistry
    
Phase 2: Identity Graph
    └── Identity groups, nodes, anonymous ID resolution
    
Phase 3: Attribution Engine
    └── Touchpoints, referral tracking, attribution rules
    
Phase 4: Campaign Rule Engine
    └── JSON-based rules, reward calculation
    
Phase 5: Reward Ledger & Settlement
    └── Asset logs, RewardsHub integration, batch settlement
    
Phase 6: Anonymous Lock Mechanism
    └── lockReward, resolveUserId, wallet connection flow
    
Phase 7: Migration & Rollout
    └── Data migration, SDK release, production cutover
```

---

## Phase 0: Foundation & Cleanup

**Goal**: Clean slate for new architecture. Remove obsolete code, prepare database schema.

### 0.1 Delete Obsolete Code

| Delete | Location | Reason |
|--------|----------|--------|
| `services/api/` directory | Entire folder | False start, merging into backend |
| Interaction tables | `domain/interactions/db/schema.ts` | Replaced by interaction_logs |
| Interaction jobs | `jobs/interactions/` | No more on-chain interaction flow |
| Interaction repositories | `domain/interactions/repositories/` | All of them |
| CampaignDataRepository | On-chain campaign reads | Campaigns in PostgreSQL now |
| MerkleTreeRepository | Oracle domain | Replaced by attestations |
| Oracle sync job | `jobs/oracle.ts` | No more merkle root syncing |

**Keep**:
- `product_oracle_purchase` / `product_oracle_purchase_item` → Rename to `purchases` / `purchase_items`
- `productOracleTable` → Rename to `merchant_webhooks` or similar
- Auth domain (WebAuthn)
- Pairing domain
- Notifications domain
- Wallet domain structure (refactor repositories)

### 0.2 Database Schema Preparation

Create new schema files in `domain/`:

```
domain/
├── merchant/
│   └── db/schema.ts        # merchants table
├── identity/
│   └── db/schema.ts        # identity_groups, identity_nodes
├── attribution/
│   └── db/schema.ts        # touchpoints
├── campaign/
│   └── db/schema.ts        # campaign_rules
├── rewards/
│   └── db/schema.ts        # asset_logs, interaction_logs
└── purchases/
    └── db/schema.ts        # purchases, purchase_items (from oracle)
```

### 0.3 Deliverables

- [ ] Delete `services/api/` directory
- [ ] Remove interaction tables and code
- [ ] Remove merkle tree / oracle sync code
- [ ] Rename oracle tables to purchases
- [ ] Create new domain directory structure
- [ ] Create empty schema files for new tables
- [ ] Database migration for table removals

---

## Phase 1: Merchant Domain

**Goal**: Web2 merchant table as source of truth. Migrate from ProductRegistry.

### 1.1 Merchant Schema

```typescript
// domain/merchant/db/schema.ts
export const merchantsTable = pgTable("merchants", {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: customHex("product_id").unique(),  // Legacy, for migration
    domain: text("domain").unique().notNull(),
    name: text("name").notNull(),
    bankAddress: customHex("bank_address"),
    webhookSignatureKey: text("webhook_signature_key"),
    webhookPlatform: text("webhook_platform"), // shopify, woocommerce, custom
    config: jsonb("config"),  // SDK config, appearance, etc.
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 1.2 Migration Script

```typescript
// scripts/migrateMerchants.ts
async function migrateMerchants() {
    // 1. Fetch all products from ProductRegistry via indexer
    const products = await indexerApi.get("products").json();
    
    // 2. For each product, create merchant record
    for (const product of products) {
        // 3. Fetch campaign config from MongoDB
        const campaignConfig = await mongo.campaigns.findOne({ productId: product.id });
        
        // 4. Get bank address (first bank for this product)
        const banks = await indexerApi.get(`banks?productId=${product.id}`).json();
        
        // 5. Insert merchant
        await db.insert(merchantsTable).values({
            productId: product.id,
            domain: product.domain,
            name: product.name,
            bankAddress: banks[0]?.address,
            webhookSignatureKey: existingOracle?.hookSignatureKey,
            webhookPlatform: existingOracle?.platform,
            config: campaignConfig,
        });
    }
}
```

### 1.3 Merchant API

```typescript
// domain/merchant/api/routes.ts
GET  /merchant/:id           // Get merchant details
GET  /merchant/by-domain     // Lookup by domain
PUT  /merchant/:id/config    // Update config (dashboard)
POST /merchant/webhook/setup // Setup webhook credentials
```

### 1.4 Deliverables

- [ ] Create merchants table schema
- [ ] Create MerchantRepository
- [ ] Migration script from ProductRegistry + MongoDB
- [ ] Merchant API routes
- [ ] Update webhook handlers to use merchant table
- [ ] Tests for merchant domain

---

## Phase 2: Identity Graph

**Goal**: Unified identity resolution across anonymous IDs, customer IDs, and wallets.

### 2.1 Identity Schema

```typescript
// domain/identity/db/schema.ts
export const identityGroupsTable = pgTable("identity_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: customHex("wallet_address").unique(),  // null until connected
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const identityNodesTable = pgTable("identity_nodes", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").references(() => identityGroupsTable.id),
    identityType: text("identity_type").notNull(), // anonymous_fingerprint, merchant_customer, wallet
    identityValue: text("identity_value").notNull(),
    merchantId: uuid("merchant_id"),  // null for wallet (global)
    createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
    unique().on(table.identityType, table.identityValue, table.merchantId),
]);
```

### 2.2 Identity Resolution Service

```typescript
// domain/identity/services/IdentityResolutionService.ts
export class IdentityResolutionService {
    /**
     * Resolve an anonymous ID to an identity group.
     * Creates new group if not found.
     */
    async resolveAnonymousId(params: {
        anonId: string;
        merchantId: string;
    }): Promise<{ identityGroupId: string; isNew: boolean }>;
    
    /**
     * Link a merchant customer ID to an identity group.
     * Merges groups if customer ID already linked elsewhere.
     */
    async linkMerchantCustomer(params: {
        identityGroupId: string;
        merchantId: string;
        customerId: string;
        customerEmail?: string;
    }): Promise<void>;
    
    /**
     * Connect wallet to identity group.
     * Triggers resolveUserId on RewardsHub.
     * Merges groups if wallet already exists elsewhere.
     */
    async connectWallet(params: {
        identityGroupId: string;
        wallet: Address;
        signature: Hex;
    }): Promise<{ merged: boolean; mergedFromGroupId?: string }>;
    
    /**
     * Find identity group by any identifier.
     */
    async findByIdentifier(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<IdentityGroup | null>;
}
```

### 2.3 Identity API

```typescript
// domain/identity/api/routes.ts
POST /identity/resolve          // Anonymous ID → identity group
POST /identity/link-customer    // Link merchant customer ID
POST /identity/link-order       // Link order ID for guest checkout correlation
POST /identity/connect-wallet   // Set wallet anchor
GET  /identity/group/:id        // Get group details (authenticated)
```

### 2.4 SDK Changes for Identity

```typescript
// SDK: simplified identity management
class FrakIdentity {
    /**
     * Initialize identity for a merchant.
     * Generates fingerprint-based anonymous ID.
     * Stores in localStorage.
     */
    async initialize(merchantId: string): Promise<{
        anonId: string;
        identityGroupId: string;
    }>;
    
    /**
     * Connect wallet to current identity.
     * Called after user creates/connects wallet.
     */
    async connectWallet(wallet: Address): Promise<void>;
}
```

### 2.5 Deliverables

- [ ] Create identity_groups and identity_nodes tables
- [ ] Create IdentityResolutionService
- [ ] Create IdentityRepository
- [ ] Identity API routes
- [ ] Merge logic implementation
- [ ] Integration with wallet connection flow
- [ ] Tests for identity resolution

---

## Phase 3: Attribution Engine

**Goal**: Track referral touchpoints and attribute conversions.

### 3.1 Attribution Schema

```typescript
// domain/attribution/db/schema.ts
export const touchpointsTable = pgTable("touchpoints", {
    id: uuid("id").primaryKey().defaultRandom(),
    identityGroupId: uuid("identity_group_id").references(() => identityGroupsTable.id),
    merchantId: uuid("merchant_id").notNull(),
    source: text("source").notNull(),  // referral_link, organic, paid_ad, etc.
    sourceData: jsonb("source_data").notNull(),
    // For referral_link: { referrer_wallet: "0x..." }
    // For paid_ad: { utm_source, utm_medium, utm_campaign }
    landingUrl: text("landing_url"),
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at"),  // Lookback window
});
```

### 3.2 Attribution Service

```typescript
// domain/attribution/services/AttributionService.ts
export class AttributionService {
    /**
     * Record a touchpoint when user arrives.
     * Called on ?ref=0xWallet or UTM params.
     */
    async recordTouchpoint(params: {
        identityGroupId: string;
        merchantId: string;
        source: TouchpointSource;
        sourceData: Record<string, unknown>;
        landingUrl?: string;
        lookbackDays?: number;  // Default: 30
    }): Promise<Touchpoint>;
    
    /**
     * Attribute a conversion (purchase) to a touchpoint.
     * Returns the winning touchpoint based on merchant rules.
     */
    async attributeConversion(params: {
        identityGroupId: string;
        merchantId: string;
    }): Promise<AttributionResult>;
}

interface AttributionResult {
    attributed: boolean;
    source: TouchpointSource;
    touchpointId?: string;
    referrerWallet?: Address;  // For referral_link source
}
```

### 3.3 Track API

```typescript
// domain/attribution/api/routes.ts
POST /track/arrival    // Record touchpoint (SDK calls this on ?ref=)
```

### 3.4 Deliverables

- [ ] Create touchpoints table
- [ ] Create AttributionService
- [ ] Create TouchpointRepository
- [ ] Track arrival API route
- [ ] Attribution logic (first-touch for now)
- [ ] Lookback window cleanup job
- [ ] Tests for attribution

---

## Phase 4: Campaign Rule Engine

**Goal**: JSON-based campaign rules, evaluated in PostgreSQL/backend.

### 4.1 Campaign Schema

```typescript
// domain/campaign/db/schema.ts
export const campaignRulesTable = pgTable("campaign_rules", {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    rule: jsonb("rule").notNull(),
    // Example rule:
    // {
    //   trigger: "purchase",
    //   conditions: [
    //     { field: "attribution.source", operator: "eq", value: "referral_link" },
    //     { field: "purchase.amount", operator: "gte", value: 50 }
    //   ],
    //   rewards: [
    //     { recipient: "referrer", type: "token", token: "USDC", amount: 10 },
    //     { recipient: "referee", type: "token", token: "USDC", percent: 5, percentOf: "purchase_amount" }
    //   ]
    // }
    
    // Budget configuration
    budget: jsonb("budget"),  // { daily: 1000, total: 50000, currency: "USDC" }
    
    // Real-time budget tracking (strict enforcement - cannot exceed by a cent)
    budgetUsedToday: numeric("budget_used_today").default("0"),
    budgetUsedTotal: numeric("budget_used_total").default("0"),
    budgetResetAt: timestamp("budget_reset_at"),  // Last daily reset
    
    expiresAt: timestamp("expires_at"),
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: timestamp("created_at").defaultNow(),
});
```

### 4.2 Rule Engine Service

```typescript
// domain/campaign/services/RuleEngineService.ts
export class RuleEngineService {
    /**
     * Evaluate campaign rules against an event context.
     * Returns calculated rewards (only if budget available).
     */
    async evaluateRules(params: {
        merchantId: string;
        trigger: CampaignTrigger;
        context: RuleContext;
    }): Promise<EvaluationResult>;
    
    /**
     * Check if conditions match the context.
     */
    private conditionsMatch(
        conditions: RuleCondition[],
        context: RuleContext
    ): boolean;
    
    /**
     * Calculate reward amount from definition.
     */
    private calculateRewardAmount(
        reward: RewardDefinition,
        context: RuleContext
    ): { amount: number; token?: Address };
    
    /**
     * Check and consume budget atomically.
     * Uses SELECT ... FOR UPDATE to prevent race conditions.
     * Returns false if budget would be exceeded.
     */
    private async checkAndConsumeBudget(
        campaignRuleId: string,
        amount: number
    ): Promise<boolean>;
}

interface RuleContext {
    purchase?: {
        amount: number;
        currency: string;
        orderId: string;
        items: PurchaseItem[];
    };
    attribution?: AttributionResult;
    user?: {
        isNew: boolean;
        totalPurchases: number;
    };
}

interface CalculatedReward {
    recipient: "referrer" | "referee" | "buyer";
    recipientIdentityGroupId: string;
    recipientWallet?: Address;  // If known
    type: "token" | "discount" | "points";
    amount: number;
    token?: Address;
    campaignRuleId: string;
}

interface EvaluationResult {
    rewards: CalculatedReward[];
    budgetExceeded: boolean;  // True if any reward was skipped due to budget
    skippedCampaigns: string[];  // Campaign IDs that hit budget limit
}
```

### 4.3 Campaign Migration

```typescript
// scripts/migrateCampaigns.ts
async function migrateCampaigns() {
    // 1. Read existing campaigns from MongoDB
    const mongoCampaigns = await mongo.campaigns.find({}).toArray();
    
    // 2. For each campaign, convert to JSON rule format
    for (const campaign of mongoCampaigns) {
        const merchantId = await getMerchantIdByProductId(campaign.productId);
        
        // 3. Convert reward configuration to new format
        const rule = {
            trigger: "purchase",
            conditions: [
                { field: "attribution.source", operator: "eq", value: "referral_link" }
            ],
            rewards: convertRewardsToNewFormat(campaign.rewards),
        };
        
        // 4. Insert campaign rule
        await db.insert(campaignRulesTable).values({
            merchantId,
            name: campaign.name,
            priority: 1,
            rule,
            budget: campaign.budget,
        });
    }
}
```

### 4.4 Deliverables

- [ ] Create campaign_rules table (with budget tracking columns)
- [ ] Create RuleEngineService
- [ ] Create CampaignRuleRepository
- [ ] Campaign CRUD API routes
- [ ] Condition evaluation logic
- [ ] Reward calculation logic
- [ ] **Real-time budget enforcement** (atomic check + consume)
- [ ] Budget reset job (daily at midnight UTC)
- [ ] Migration script from MongoDB
- [ ] Tests for rule engine
- [ ] Tests for budget edge cases

---

## Phase 5: Reward Ledger & Settlement

**Goal**: Track rewards from creation to claim. Batch settlement to RewardsHub.

### 5.1 Reward Schema

```typescript
// domain/rewards/db/schema.ts
export const interactionLogsTable = pgTable("interaction_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),  // referral_arrival, purchase, wallet_connect, etc.
    identityGroupId: uuid("identity_group_id"),
    merchantId: uuid("merchant_id"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow(),
});

export const assetLogsTable = pgTable("asset_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    identityGroupId: uuid("identity_group_id").notNull(),
    merchantId: uuid("merchant_id").notNull(),
    campaignRuleId: uuid("campaign_rule_id"),
    
    assetType: text("asset_type").notNull(),  // token, discount, points
    amount: numeric("amount").notNull(),
    tokenAddress: customHex("token_address"),
    
    recipientType: text("recipient_type").notNull(),  // referrer, referee, buyer
    referrerWallet: customHex("referrer_wallet"),  // Denormalized
    
    status: text("status").notNull().default("pending"),
    // Status: pending → ready_to_claim → claimed (or cancelled)
    statusChangedAt: timestamp("status_changed_at").defaultNow(),
    
    touchpointId: uuid("touchpoint_id"),
    purchaseId: text("purchase_id"),
    interactionLogId: uuid("interaction_log_id"),
    
    onchainTxHash: text("onchain_tx_hash"),
    onchainBlock: bigint("onchain_block", { mode: "bigint" }),
    
    createdAt: timestamp("created_at").defaultNow(),
});
// Note: No clearance period (claimableAt) or expiry in V1
```

### 5.2 Reward Processing Service

```typescript
// domain/rewards/services/RewardProcessingService.ts
export class RewardProcessingService {
    /**
     * Process a purchase event.
     * - Run attribution
     * - Evaluate campaign rules
     * - Check budget (real-time, strict)
     * - Create asset_logs entries
     */
    async processPurchase(params: {
        merchantId: string;
        identityGroupId: string;
        orderId: string;
        amount: number;
        currency: string;
        items: PurchaseItem[];
    }): Promise<{ rewards: AssetLog[]; budgetExceeded: boolean }>;
    
    /**
     * Atomically check and consume budget.
     * Returns false if budget would be exceeded.
     */
    private async consumeBudget(params: {
        campaignRuleId: string;
        amount: number;
    }): Promise<boolean>;
}
```

### 5.3 Settlement Service

```typescript
// domain/rewards/services/SettlementService.ts
export class SettlementService {
    /**
     * Batch settle pending rewards to RewardsHub.
     * Called by settlement job (configurable frequency).
     * Uses `rewarder` backend key for authorization.
     */
    async settleRewards(): Promise<SettlementResult>;
    
    /**
     * Build attestation for a reward.
     * V1 format: [{ event, timestampInSecond }]
     */
    private buildAttestation(reward: AssetLog): string;
    
    /**
     * Push rewards to wallets (known wallet addresses).
     */
    private async pushRewards(rewards: AssetLog[]): Promise<TxHash>;
    
    /**
     * Lock rewards for anonymous users (no wallet yet).
     */
    private async lockRewards(rewards: AssetLog[]): Promise<TxHash>;
}

interface SettlementResult {
    pushedCount: number;
    lockedCount: number;
    failedCount: number;
    txHashes: string[];
}
```

### 5.4 Settlement Job

```typescript
// jobs/settlement.ts
export async function settlementJob() {
    const settlementService = new SettlementService();
    
    // Settle all pending rewards (no clearance period in V1)
    const result = await settlementService.settleRewards();
    
    log.info({
        pushed: result.pushedCount,
        locked: result.lockedCount,
        failed: result.failedCount,
        txHashes: result.txHashes,
    }, "Settlement job completed");
}

// Run every hour for good UX
schedule.every("0 * * * *", settlementJob);
```

### 5.4.1 Budget Reset Job

```typescript
// jobs/budgetReset.ts
export async function budgetResetJob() {
    // Reset daily budget counters at midnight UTC
    await db.update(campaignRulesTable)
        .set({ 
            budgetUsedToday: 0,
            budgetResetAt: new Date(),
        })
        .where(isNotNull(campaignRulesTable.budget));
    
    log.info("Daily budget counters reset");
}

// Run at midnight UTC
schedule.every("0 0 * * *", budgetResetJob);
```

### 5.5 RewardsHub Contract Integration

```typescript
// infrastructure/blockchain/contracts/RewardsHubRepository.ts
export class RewardsHubRepository {
    /**
     * All methods use the `rewarder` backend key for authorization.
     * Key managed via adminWalletsRepository.getKeySpecificAccount({ key: "rewarder" })
     */
    
    async pushReward(params: {
        wallet: Address;
        amount: bigint;
        token: Address;
        bank: Address;
        attestation: string;  // base64 encoded JSON
    }): Promise<TxHash>;
    
    async pushRewards(rewards: PushRewardParams[]): Promise<TxHash>;
    
    async lockReward(params: {
        userId: Hex;  // identityGroupId as bytes32
        amount: bigint;
        token: Address;
        bank: Address;
        attestation: string;
    }): Promise<TxHash>;
    
    async lockRewards(locks: LockRewardParams[]): Promise<TxHash>;
    
    async resolveUserId(params: {
        userId: Hex;
        wallet: Address;
    }): Promise<TxHash>;
}

// Attestation helper
function buildAttestation(events: Array<{ event: string; timestamp: Date }>): string {
    const payload = events.map(e => ({
        event: e.event,
        timestampInSecond: Math.floor(e.timestamp.getTime() / 1000),
    }));
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
```

### 5.6 Deliverables

- [ ] Create interaction_logs and asset_logs tables
- [ ] Create InteractionLogRepository
- [ ] Create AssetLogRepository
- [ ] Create RewardProcessingService
- [ ] Create SettlementService
- [ ] Create RewardsHubRepository (with `rewarder` key)
- [ ] Create settlementJob
- [ ] Create budgetResetJob
- [ ] Attestation encoding logic (`[{event, timestampInSecond}]`)
- [ ] Rewards API for wallet queries
- [ ] Tests for reward processing and settlement

---

## Phase 6: Anonymous Lock Mechanism

**Goal**: Support rewards for users who don't have wallets yet.

### 6.1 Lock Flow

```
1. Purchase event arrives for anonymous user
   - identityGroup exists but wallet is null
   
2. Reward calculation happens normally
   - Budget checked (real-time, strict)
   - asset_log created with status: pending
   
3. Settlement job runs (next batch)
   - Detects: identityGroup.wallet is null
   - Calls: RewardsHub.lockReward(identityGroupId, amount, ...)
   - status: pending → ready_to_claim (locked)
   
4. Later: user connects wallet
   - POST /identity/connect-wallet
   - Backend updates identityGroup.wallet
   - Backend calls: RewardsHub.resolveUserId(identityGroupId, wallet)
   - All locked rewards now assigned to wallet
   
5. User claims
   - RewardsHub.claim() from wallet
```

> **Note**: No clearance period. Rewards go straight to settlement in next batch.

### 6.2 Identity Service Enhancement

```typescript
// domain/identity/services/IdentityResolutionService.ts
async connectWallet(params: {
    identityGroupId: string;
    wallet: Address;
    signature: Hex;
}): Promise<ConnectWalletResult> {
    // 1. Verify signature (wallet ownership)
    const isValid = await verifyWalletSignature(wallet, signature);
    if (!isValid) throw new Error("Invalid signature");
    
    // 2. Check if wallet already belongs to another group
    const existingGroup = await this.findByWallet(wallet);
    
    if (existingGroup && existingGroup.id !== identityGroupId) {
        // MERGE: existingGroup is anchor (has wallet)
        await this.mergeGroups({
            anchorGroupId: existingGroup.id,
            mergingGroupId: identityGroupId,
        });
        
        // Resolve the merging group's locked rewards to wallet
        await this.rewardsHub.resolveUserId(identityGroupId, wallet);
        
        return { merged: true, mergedFromGroupId: identityGroupId };
    }
    
    // 3. Update identity group with wallet
    await db.update(identityGroupsTable)
        .set({ walletAddress: wallet, updatedAt: new Date() })
        .where(eq(identityGroupsTable.id, identityGroupId));
    
    // 4. Create wallet identity node
    await db.insert(identityNodesTable).values({
        groupId: identityGroupId,
        identityType: "wallet",
        identityValue: wallet,
        merchantId: null,  // Wallet is global
    });
    
    // 5. Resolve any locked rewards on-chain
    await this.rewardsHub.resolveUserId(identityGroupId, wallet);
    
    return { merged: false };
}
```

### 6.3 UserId Encoding

```typescript
// utils/userId.ts
/**
 * Encode identity group UUID to bytes32 for contract.
 */
function encodeUserId(identityGroupId: string): Hex {
    // Remove hyphens, pad to 32 bytes
    const clean = identityGroupId.replace(/-/g, "");
    return `0x${clean.padStart(64, "0")}` as Hex;
}

/**
 * Decode bytes32 back to UUID.
 */
function decodeUserId(userId: Hex): string {
    const clean = userId.slice(2).replace(/^0+/, "");
    // Reformat as UUID
    return `${clean.slice(0,8)}-${clean.slice(8,12)}-${clean.slice(12,16)}-${clean.slice(16,20)}-${clean.slice(20)}`;
}
```

### 6.4 Deliverables

- [ ] Enhance IdentityResolutionService.connectWallet
- [ ] Add mergeGroups logic
- [ ] UserId encoding utilities
- [ ] RewardsHub.resolveUserId integration
- [ ] Handle merge edge cases
- [ ] Tests for anonymous → wallet flow

---

## Phase 7: Migration & Rollout

**Goal**: Safe migration of existing data and coordinated rollout.

### 7.1 Data Migration Plan

```
Step 1: Schema Migration
   └── Create all new tables alongside existing
   └── No data modification yet

Step 2: Merchant Migration
   └── Populate merchants from ProductRegistry
   └── Keep productId for reference
   └── Run in background, non-blocking

Step 3: Campaign Migration
   └── Convert MongoDB campaigns to JSON rules
   └── Validate conversion
   └── Insert into campaign_rules

Step 4: Reward Migration
   └── Query indexer for all unclaimed rewards
   └── Create asset_logs with status ready_to_claim
   └── Verify totals match on-chain

Step 5: Cleanup
   └── After successful verification
   └── Remove old tables
   └── Remove old code
```

### 7.2 SDK Release

```
New SDK Version: 2.0.0

Changes:
- Remove interaction signing
- Remove on-chain interaction encoding
- Add simplified event tracking
- Add anonymous ID management
- Add wallet connection flow

Migration Guide:
1. Update SDK dependency
2. Update initialization (add merchantId)
3. Remove any interaction-related code
4. Add wallet connection handler
```

### 7.3 Contract Deployment

```
Deploy Order:
1. RewardsHub contract (new)
   └── Supports push, lock, resolve
   └── Multiple tokens per bank

2. Bank updates (if needed)
   └── Authorize RewardsHub as spender
   └── Per merchant, one-time setup
```

### 7.4 Rollout Strategy

```
Week 1: Internal Testing
   └── Deploy to dev environment
   └── Test with synthetic merchants
   └── Verify all flows work

Week 2: Beta Merchants
   └── 1-2 friendly merchants
   └── Monitor closely
   └── Gather feedback

Week 3: Gradual Rollout
   └── 25% of merchants
   └── Feature flag controlled
   └── Quick rollback capability

Week 4: Full Rollout
   └── All merchants
   └── Deprecate old endpoints
   └── Monitor for issues

Week 5+: Cleanup
   └── Remove old code
   └── Archive old tables
   └── Documentation updates
```

### 7.5 Deliverables

- [ ] Schema migration scripts
- [ ] Data migration scripts with verification
- [ ] SDK 2.0.0 release
- [ ] Contract deployment scripts
- [ ] Feature flags for gradual rollout
- [ ] Monitoring dashboards
- [ ] Rollback procedures
- [ ] Documentation updates

---

## What's First?

### Recommended Starting Point: Phase 1 + Phase 2

Start with **Merchant Domain** and **Identity Graph** because:

1. **Foundation**: Everything else depends on merchant and identity resolution
2. **Low Risk**: No blockchain changes needed yet
3. **Testable**: Can verify migration without affecting production
4. **Visible Progress**: Dashboard can show migrated merchants

### Initial Sprint (2-3 weeks)

```
Week 1:
├── Delete services/api/
├── Create new domain structure
├── Implement merchants table
├── Write migration script (products → merchants)
└── Merchant API routes

Week 2:
├── Implement identity_groups, identity_nodes
├── IdentityResolutionService
├── Identity API routes
├── Touchpoints table
└── Basic attribution

Week 3:
├── Connect identity to existing wallet auth
├── Test anonymous → wallet flow
├── Integration tests
└── Review and refine
```

### Success Criteria for Phase 1+2

- [ ] All products migrated to merchants table
- [ ] New merchant lookups work (by domain, by productId)
- [ ] Identity groups created on SDK init
- [ ] Touchpoints recorded on referral arrival
- [ ] Wallet connection updates identity group
- [ ] No production impact (new code path only)

---

## Technical Debt to Address

| Item | Priority | Phase |
|------|----------|-------|
| Remove MongoDB dependency | High | After campaign migration (Phase 4) |
| Consolidate indexer calls | Medium | Phase 5 (settlement uses local data) |
| Simplify webhook handling | Medium | Phase 1 (merge with merchant) |
| Remove LRU caches for on-chain data | Low | Phase 4 (data in PostgreSQL) |
| Clean up test mocks | Low | Ongoing |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Full backups, verification queries, rollback scripts |
| Incorrect reward calculations | Compare with on-chain indexer, dual-write period |
| Contract bugs | Audit new RewardsHub, testnet deployment first |
| SDK breaking changes | Major version bump, migration guide, support period |
| Performance regression | Load testing, monitoring, feature flags |

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| Clearance Period | **None in V1** - Removed for simplicity. Can add later if needed. |
| Budget Tracking | **Real-time, strict** - Cannot exceed by a single cent. |
| Attestation Format | **Simple event log** - `[{event, timestampInSecond}]` as base64. |
| RewardsHub Authorization | **`rewarder` backend key** - New key in adminWalletsRepository. |
| UserId Format | **UUID as bytes32** - Direct encoding, no translation table. |
| Multiple Banks per Merchant | **Single default token per merchant** - V1 uses merchant's default token only. Future: token mapping based on user's local currency (configured in campaign rules, stablecoins only). |
| Settlement Frequency | **Hourly** - Settlement job runs every hour for better UX. |
| Budget Currency | **Merchant's default token** - Budget tracked in merchant's default token. Token mapping for distributing other currencies is out of scope for V1 (KISS). |

## Open Questions

*All questions resolved - see above.*

---

*This plan will be updated as implementation progresses.*
