# Backend Routes Consolidation & Dashboard Migration Plan

**Status**: Planning
**Created**: 2026-01-14
**Priority**: User Reward History endpoint first
**Migration Strategy**: Progressive (endpoint by endpoint)

---

## Related Documents

- `REFACTO_PLAN.md` - This plan completes **Phase 7** (Rewards API for wallet queries)
- `REFACTO_ARCHITECTURE.md` - Defines `asset_logs`, `interaction_logs`, identity graph model
- `FRONTEND_MIGRATION_GUIDE.md` - **Update after implementation** with new endpoints
- `ANONYMOUS_REWARDS_SIMPLIFICATION.md` - Settlement is now simplified (no more locking)

---

## Context

The business dashboard (TanStack Start) currently contains server-side logic that should live in the backend:
- Campaign management (7 server action files)
- Product/role management (3 files)
- Member management (1 file)
- Direct MongoDB and blockchain connections

**Goal**: Consolidate all business logic in the Elysia backend and transform the dashboard into a pure API client.

---

## Phase 1: User Reward History (CURRENT PRIORITY)

### Missing Endpoint
Users currently can see claimable/pending balances but have no way to see their reward history (why they earned rewards, from which site, when).

### Decision: `/rewards/history` Scope (TOKEN-ONLY vs ALL ASSET TYPES)

This endpoint is backed by `asset_logs`, which supports multiple asset types (`token`, `discount`, `points`) and has `tokenAddress` as nullable.

**Option A (recommended MVP): Token rewards only**
- Query filters: `assetType = "token"` and `tokenAddress IS NOT NULL`
- Response stays simple (token metadata always present)
- Aligns with current wallet UX focus (token balances + claimable) and avoids designing a polymorphic response too early

**Option B: Include all reward asset types**
- Response must become polymorphic:
  - Include `assetType` in every item
  - `token` becomes optional/nullable (only present for `assetType="token"`)
  - Soft rewards need additional fields (e.g. discount code / points unit) depending on current DB payload model
- Requires tighter product decisions on how “discount/points” should be displayed and what metadata must be exposed

> **Recommendation**: Implement Option A for Phase 1, and extend to Option B later once soft reward UX is confirmed.

### Files to Create/Modify

1. **`services/backend/src/api/user/wallet/routes/rewards.ts`** (new)
   - Route `GET /rewards/history` with pagination
   - Uses `sessionContext` for auth (same pattern as `balance.ts`)

2. **`services/backend/src/domain/rewards/repositories/AssetLogRepository.ts`** (modify)
   - Add import: `import { merchantsTable } from "../../merchant/db/schema";`
   - Add method `findByIdentityGroup(groupId, options)`
   - Join on `interaction_logs` for interaction type (pattern: see `findPendingForSettlement`)
   - Join on `merchants` for name/domain

3. **`services/backend/src/api/user/wallet/index.ts`** (modify)
   - Import and `.use(rewardsRoutes)`

### Query Implementation (AssetLogRepository)

```typescript
async findByIdentityGroup(
  identityGroupId: string,
  options: { limit?: number; offset?: number; status?: AssetStatus[] }
): Promise<RewardHistoryItem[]> {
  // Build conditions array
  const conditions = [eq(assetLogsTable.identityGroupId, identityGroupId)];
  if (options.status?.length) {
    conditions.push(inArray(assetLogsTable.status, options.status));
  }

  return db
    .select({
      id: assetLogsTable.id,
      amount: assetLogsTable.amount,
      tokenAddress: assetLogsTable.tokenAddress,
      status: assetLogsTable.status,
      recipientType: assetLogsTable.recipientType,
      createdAt: assetLogsTable.createdAt,
      settledAt: assetLogsTable.settledAt,
      onchainTxHash: assetLogsTable.onchainTxHash,
      // Interaction info
      interactionType: interactionLogsTable.type,
      // Merchant info
      merchantId: merchantsTable.id,
      merchantName: merchantsTable.name,
      merchantDomain: merchantsTable.domain,
    })
    .from(assetLogsTable)
    .leftJoin(interactionLogsTable, eq(assetLogsTable.interactionLogId, interactionLogsTable.id))
    .innerJoin(merchantsTable, eq(assetLogsTable.merchantId, merchantsTable.id))
    .where(and(...conditions))
    .orderBy(desc(assetLogsTable.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);
}
```

### Route Implementation

```typescript
// services/backend/src/api/user/wallet/routes/rewards.ts
export const rewardsRoutes = new Elysia({ prefix: "/rewards" })
  .use(sessionContext)
  .get(
    "/history",
    async ({ walletSession, query }) => {
      const { limit = 50, offset = 0, status } = query;

      // Get identity group from wallet (uses existing IdentityRepository method)
      const identityGroup = await identityRepository.findGroupByIdentity({
        type: "wallet",
        value: walletSession.address,
      });
      if (!identityGroup) return { rewards: [], pagination: { total: 0, offset, limit } };

      // Fetch rewards and total count in parallel
      const [rewards, total] = await Promise.all([
        assetLogRepository.findByIdentityGroup(identityGroup.id, { limit, offset, status }),
        assetLogRepository.countByIdentityGroup(identityGroup.id, { status }),
      ]);

      // Batch fetch token metadata to avoid N+1
      const uniqueTokens = [...new Set(rewards.map((r) => r.tokenAddress))] as Address[];
      const tokenMetadataList = await Promise.all(
        uniqueTokens.map((addr) => getTokenMetadata(addr))
      );
      const tokenMap = new Map(uniqueTokens.map((addr, i) => [addr, tokenMetadataList[i]]));

      // Enrich rewards (sync - no more async in map)
      const enriched = rewards.map((r) => ({
        id: r.id,
        amount: r.amount,
        token: tokenMap.get(r.tokenAddress),
        status: r.status,
        trigger: mapInteractionType(r.interactionType),
        recipientType: r.recipientType,
        merchant: { id: r.merchantId, name: r.merchantName, domain: r.merchantDomain },
        earnedAt: r.createdAt.toISOString(),
        settledAt: r.settledAt?.toISOString(),
        txHash: r.onchainTxHash,
      }));

      return { rewards: enriched, pagination: { total, offset, limit } };
    },
    {
      withWalletAuthent: true,
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
        status: t.Optional(t.Array(t.Union([
          t.Literal("pending"),
          t.Literal("processing"),
          t.Literal("settled"),
          t.Literal("consumed"),
          t.Literal("cancelled"),
          t.Literal("expired"),
        ]))),
      }),
      response: {
        401: t.String(),
        200: t.Object({
          rewards: t.Array(t.Object({
            id: t.String(),
            amount: t.String(),
            token: t.Object({
              address: t.Address(),
              symbol: t.String(),
              decimals: t.Number(),
            }),
            status: t.Union([
              t.Literal("pending"),
              t.Literal("processing"),
              t.Literal("settled"),
              t.Literal("consumed"),
              t.Literal("cancelled"),
              t.Literal("expired"),
            ]),
            trigger: t.Union([
              t.Literal("referral"),
              t.Literal("purchase"),
              t.Literal("wallet_connect"),
              t.Literal("identity_merge"),
              t.Null(),
            ]),
            recipientType: t.Union([
              t.Literal("referrer"),
              t.Literal("referee"),
              t.Literal("user"),
            ]),
            merchant: t.Object({
              id: t.String(),
              name: t.String(),
              domain: t.String(),
            }),
            earnedAt: t.String(),
            settledAt: t.Optional(t.String()),
            txHash: t.Optional(t.Hex()),
          })),
          pagination: t.Object({
            total: t.Number(),
            offset: t.Number(),
            limit: t.Number(),
          }),
        }),
      },
    }
  );
```

### Response Shape

```typescript
{
  rewards: Array<{
    id: string;
    amount: string;
    token: { address: Address; symbol: string; decimals: number };
    status: "pending" | "processing" | "settled" | "consumed" | "cancelled" | "expired";
    trigger: "referral" | "purchase" | "wallet_connect" | "identity_merge" | null;
    recipientType: "referrer" | "referee" | "user";
    merchant: { id: string; name: string; domain: string };
    earnedAt: string; // ISO date
    settledAt?: string; // ISO date
    txHash?: Hex;
  }>;
  pagination: { total: number; offset: number; limit: number };
}
```

> **Note**: Status values from `assetStatusEnum` in `domain/rewards/db/schema.ts`.
> `consumed` = soft reward used (discount redeemed). No `claimed` status - on-chain claiming is tracked via RewardsHub smart contract, not in DB.

### Interaction Type Mapping

From `interaction_logs.type` (defined in REFACTO_ARCHITECTURE.md):

| DB Value | API Response |
|----------|--------------|
| `referral_arrival` | `"referral"` |
| `purchase` | `"purchase"` |
| `wallet_connect` | `"wallet_connect"` |
| `identity_merge` | `"identity_merge"` |
| `null` | `null` |

### Reward Status Flow (Simplified)

Per ANONYMOUS_REWARDS_SIMPLIFICATION.md and `assetStatusEnum`:

```
                    ┌─────────────┐
                    │   pending   │ ← Reward created
                    └─────┬───────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌─────────┐ ┌─────────┐
        │processing│ │cancelled│ │ expired │
        └────┬─────┘ └─────────┘ └─────────┘
             │           (fraud)    (no wallet
             │                       in time)
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐     ┌─────────┐
│ settled │     │ pending │ (retry on failure)
└────┬────┘     └─────────┘
     │
     ▼ (soft rewards only)
┌──────────┐
│ consumed │
└──────────┘
```

- **pending**: Reward created, waiting for wallet + settlement batch
- **processing**: Currently being settled on-chain
- **settled**: On-chain, user can claim via RewardsHub smart contract
- **consumed**: Soft reward used (discount redeemed) - NOT for token rewards
- **cancelled**: Refunded or fraud detected
- **expired**: Pending reward expired (no wallet connected in time)

> **Important**: There is NO `claimed` status in DB. On-chain claiming is tracked by the RewardsHub smart contract, not the backend.

### Known Issues & Fixes Required

> **Status**: Issues 1, 3, 4, 5 are now addressed in the code snippets above.
> Issues 2 and 6 require creating new files during implementation.

#### 0. Scope mismatch (Token-only vs All asset types)

The current response schema requires `token` for every reward item, but `asset_logs.tokenAddress` is nullable and `assetType` can be `discount` or `points`.

- If Phase 1 is **token-only**: enforce `assetType="token"` and `tokenAddress IS NOT NULL` in both:
  - `findByIdentityGroup(...)`
  - `countByIdentityGroup(...)`
- If Phase 1 includes **all asset types**: update the response shape to be polymorphic (see Decision section above).

#### 1. Pagination Total Count (CRITICAL)

Line 122 returns `enriched.length` as total, which is just the page size. Need separate COUNT query:

```typescript
// In AssetLogRepository - add count method
async countByIdentityGroup(
  identityGroupId: string,
  options?: { status?: AssetStatus[] }
): Promise<number> {
  const conditions = [eq(assetLogsTable.identityGroupId, identityGroupId)];
  if (options?.status?.length) {
    conditions.push(inArray(assetLogsTable.status, options.status));
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetLogsTable)
    .where(and(...conditions));
  return result?.count ?? 0;
}

// In route handler - use count
const [rewards, total] = await Promise.all([
  assetLogRepository.findByIdentityGroup(identityGroup.id, { limit, offset, status }),
  assetLogRepository.countByIdentityGroup(identityGroup.id, { status }),
]);
// ...
return { rewards: enriched, pagination: { total, offset, limit } };
```

#### 2. Missing Helper Functions

`getTokenMetadata` and `mapInteractionType` are referenced but undefined.

**Token metadata (repo-aligned guidance)**:
- This backend already has token metadata fetching + caching in:
  - `services/backend/src/domain/wallet/repositories/BalancesRepository.ts` (`getTokenMetadata()` + LRU cache)
  - It also loads known tokens from the indexer (`getKnownTokens()`), which is helpful to avoid chain calls when possible.
- Prefer reusing that code path (or extracting a small shared helper in `domain/wallet` / `@backend-infrastructure`) instead of introducing a new `tokenMetadataCache` under `infrastructure/`.

**Interaction type mapping**:
- Keep as a small pure helper (can live in `domain/rewards/utils/interactionTypeMapper.ts`) mapping DB values:
  - `referral_arrival` → `referral`
  - `purchase` → `purchase`
  - `wallet_connect` → `wallet_connect`
  - `identity_merge` → `identity_merge`

> Note: Avoid `async map()` patterns here (same as the N+1 note below); keep enrichment synchronous after batching.

#### 3. N+1 Query Risk

`Promise.all(rewards.map(getTokenMetadata))` fires N queries. Optimize:

```typescript
// Batch token addresses first - preserve Address type
const uniqueTokens = [...new Set(rewards.map((r) => r.tokenAddress))] as Address[];
const tokenMetadata = await Promise.all(
  uniqueTokens.map((addr) => getTokenMetadata(addr))
);
const tokenMap = new Map(uniqueTokens.map((addr, i) => [addr, tokenMetadata[i]]));

// Then map without async
const enriched = rewards.map((r) => ({
  // ...
  token: tokenMap.get(r.tokenAddress),
  // ...
}));
```

#### 4. Add Status Filter to Query Params

The repository signature has `status?: AssetStatus[]` but query params don't expose it. Add filtering:

```typescript
// In route config - add status filter
query: t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ minimum: 0 })),
  status: t.Optional(t.Array(t.Union([
    t.Literal("pending"),
    t.Literal("processing"),
    t.Literal("settled"),
    t.Literal("consumed"),
    t.Literal("cancelled"),
    t.Literal("expired"),
  ]))),
}),

// In handler
const { limit = 50, offset = 0, status } = query;
// Pass status to repository calls
```

#### 5. Response Schema with Error Handling

Follow `balance.ts` pattern with proper error responses and custom type helpers:

```typescript
// Use existing custom type helpers from @backend-utils
import { t } from "@backend-utils";

// Response schema following balance.ts pattern
{
  withWalletAuthent: true,
  query: t.Object({
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    offset: t.Optional(t.Number({ minimum: 0 })),
    status: t.Optional(t.Array(t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("settled"),
      t.Literal("consumed"),
      t.Literal("cancelled"),
      t.Literal("expired"),
    ]))),
  }),
  response: {
    401: t.String(),
    200: t.Object({
      rewards: t.Array(t.Object({
        id: t.String(),
        amount: t.String(),
        token: t.Object({
          address: t.Address(),
          symbol: t.String(),
          decimals: t.Number(),
        }),
        status: t.Union([
          t.Literal("pending"),
          t.Literal("processing"),
          t.Literal("settled"),
          t.Literal("consumed"),
          t.Literal("cancelled"),
          t.Literal("expired"),
        ]),
        trigger: t.Union([
          t.Literal("referral"),
          t.Literal("purchase"),
          t.Literal("wallet_connect"),
          t.Literal("identity_merge"),
          t.Null(),
        ]),
        recipientType: t.Union([
          t.Literal("referrer"),
          t.Literal("referee"),
          t.Literal("user"),
        ]),
        merchant: t.Object({
          id: t.String(),
          name: t.String(),
          domain: t.String(),
        }),
        earnedAt: t.String(),
        settledAt: t.Optional(t.String()),
        txHash: t.Optional(t.Hex()),
      })),
      pagination: t.Object({
        total: t.Number(),
        offset: t.Number(),
        limit: t.Number(),
      }),
    }),
  },
}
```

#### 6. Consider Extracting Shared Status/Type Enums

To avoid duplication, consider extracting shared enums to `@backend-utils`:

```typescript
// services/backend/src/utils/schemas/rewards.ts
export const AssetStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("processing"),
  t.Literal("settled"),
  t.Literal("consumed"),
  t.Literal("cancelled"),
  t.Literal("expired"),
]);

export const InteractionTriggerSchema = t.Union([
  t.Literal("referral"),
  t.Literal("purchase"),
  t.Literal("wallet_connect"),
  t.Literal("identity_merge"),
  t.Null(),
]);

export const RecipientTypeSchema = t.Union([
  t.Literal("referrer"),
  t.Literal("referee"),
  t.Literal("user"),
]);
```

---

## Phase 2: New Business Endpoints

### 2.1 Campaign Stats/Analytics

**Route**: `GET /business/merchant/:merchantId/campaigns/stats`

#### Files to Create/Modify

1. **`services/backend/src/api/business/routes/merchant/campaignStats.ts`** (new)
   - Route with date range filtering
   - Uses `businessSessionContext` for auth (same pattern as `campaigns.ts`)

2. **`services/backend/src/domain/campaign/repositories/CampaignStatsRepository.ts`** (new)
   - Aggregation queries on `interaction_logs`, `asset_logs`, `touchpoints`
   - Group by campaign, time period

3. **`services/backend/src/api/business/routes/merchant/index.ts`** (modify)
   - Import and `.use(campaignStatsRoutes)`

#### Data Sources

| Table | Metrics |
|-------|---------|
| `touchpoints` | Impressions by source (referral_link, organic, paid_ad, direct) |
| `interaction_logs` | Conversions by type (referral_arrival, purchase, wallet_connect) |
| `asset_logs` | Rewards distributed (amount, status, recipient type) |
| `campaign_rules` | Budget usage (`budgetUsed`), campaign metadata |

#### Query Implementation (CampaignStatsRepository)

```typescript
// services/backend/src/domain/campaign/repositories/CampaignStatsRepository.ts
import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import { touchpointsTable } from "../../attribution/db/schema";
import { interactionLogsTable, assetLogsTable } from "../../rewards/db/schema";
import { campaignRulesTable } from "../db/schema";

export type DateRange = {
    from: Date;
    to: Date;
};

export type CampaignStats = {
    campaignId: string;
    campaignName: string;
    status: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    rewardsDistributed: {
        total: string;
        pending: string;
        settled: string;
        byRecipient: {
            referrer: string;
            referee: string;
            user: string;
        };
    };
    budgetUsed: Record<string, { used: number; limit: number }>;
};

export class CampaignStatsRepository {
    /**
     * Get aggregated stats for all campaigns of a merchant
     */
    async getStatsByMerchant(
        merchantId: string,
        dateRange?: DateRange
    ): Promise<CampaignStats[]> {
        // 1. Get all campaigns for merchant
        const campaigns = await db
            .select()
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.merchantId, merchantId));

        // 2. Get touchpoint counts (impressions) grouped by source
        const touchpointConditions = [eq(touchpointsTable.merchantId, merchantId)];
        if (dateRange) {
            touchpointConditions.push(
                gte(touchpointsTable.createdAt, dateRange.from),
                lte(touchpointsTable.createdAt, dateRange.to)
            );
        }

        const impressions = await db
            .select({
                source: touchpointsTable.source,
                count: count(),
            })
            .from(touchpointsTable)
            .where(and(...touchpointConditions))
            .groupBy(touchpointsTable.source);

        // 3. Get interaction counts (conversions) by type
        const interactionConditions = [eq(interactionLogsTable.merchantId, merchantId)];
        if (dateRange) {
            interactionConditions.push(
                gte(interactionLogsTable.createdAt, dateRange.from),
                lte(interactionLogsTable.createdAt, dateRange.to)
            );
        }

        const interactions = await db
            .select({
                type: interactionLogsTable.type,
                count: count(),
            })
            .from(interactionLogsTable)
            .where(and(...interactionConditions))
            .groupBy(interactionLogsTable.type);

        // 4. Get reward stats grouped by campaign
        const rewardConditions = [eq(assetLogsTable.merchantId, merchantId)];
        if (dateRange) {
            rewardConditions.push(
                gte(assetLogsTable.createdAt, dateRange.from),
                lte(assetLogsTable.createdAt, dateRange.to)
            );
        }

        const rewardsByCampaign = await db
            .select({
                campaignRuleId: assetLogsTable.campaignRuleId,
                status: assetLogsTable.status,
                recipientType: assetLogsTable.recipientType,
                totalAmount: sum(assetLogsTable.amount),
                count: count(),
            })
            .from(assetLogsTable)
            .where(and(...rewardConditions))
            .groupBy(
                assetLogsTable.campaignRuleId,
                assetLogsTable.status,
                assetLogsTable.recipientType
            );

        // 5. Aggregate into campaign stats
        return campaigns.map((campaign) => {
            const campaignRewards = rewardsByCampaign.filter(
                (r) => r.campaignRuleId === campaign.id
            );

            const totalImpressions = impressions.reduce((sum, i) => sum + i.count, 0);
            const totalConversions = interactions
                .filter((i) => i.type === "purchase")
                .reduce((sum, i) => sum + i.count, 0);

            return {
                campaignId: campaign.id,
                campaignName: campaign.name,
                status: campaign.status,
                impressions: totalImpressions,
                conversions: totalConversions,
                conversionRate: totalImpressions > 0
                    ? (totalConversions / totalImpressions) * 100
                    : 0,
                rewardsDistributed: this.aggregateRewards(campaignRewards),
                budgetUsed: this.formatBudgetUsed(campaign.budgetConfig, campaign.budgetUsed),
            };
        });
    }

    /**
     * Get stats for a single campaign
     */
    async getStatsByCampaign(
        campaignId: string,
        dateRange?: DateRange
    ): Promise<CampaignStats | null> {
        const campaign = await db
            .select()
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.id, campaignId))
            .limit(1);

        if (!campaign[0]) return null;

        const stats = await this.getStatsByMerchant(campaign[0].merchantId, dateRange);
        return stats.find((s) => s.campaignId === campaignId) ?? null;
    }

    private aggregateRewards(
        rewards: Array<{
            status: string;
            recipientType: string;
            totalAmount: string | null;
        }>
    ) {
        const byStatus = { pending: 0n, settled: 0n };
        const byRecipient = { referrer: 0n, referee: 0n, user: 0n };

        for (const r of rewards) {
            const amount = BigInt(r.totalAmount ?? "0");
            if (r.status === "pending" || r.status === "processing") {
                byStatus.pending += amount;
            } else if (r.status === "settled") {
                byStatus.settled += amount;
            }
            if (r.recipientType in byRecipient) {
                byRecipient[r.recipientType as keyof typeof byRecipient] += amount;
            }
        }

        const total = byStatus.pending + byStatus.settled;

        return {
            total: total.toString(),
            pending: byStatus.pending.toString(),
            settled: byStatus.settled.toString(),
            byRecipient: {
                referrer: byRecipient.referrer.toString(),
                referee: byRecipient.referee.toString(),
                user: byRecipient.user.toString(),
            },
        };
    }

    private formatBudgetUsed(
        config: Array<{ label: string; amount: number }> | null,
        used: Record<string, { used: number }> | null
    ): Record<string, { used: number; limit: number }> {
        if (!config) return {};

        return Object.fromEntries(
            config.map((c) => [
                c.label,
                { used: used?.[c.label]?.used ?? 0, limit: c.amount },
            ])
        );
    }
}
```

#### Route Implementation

```typescript
// services/backend/src/api/business/routes/merchant/campaignStats.ts
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignContext } from "../../../../domain/campaign";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";

// Instantiate repository (add to CampaignContext in production)
import { CampaignStatsRepository } from "../../../../domain/campaign/repositories/CampaignStatsRepository";
const statsRepository = new CampaignStatsRepository();

const RewardStatsSchema = t.Object({
    total: t.String(),
    pending: t.String(),
    settled: t.String(),
    byRecipient: t.Object({
        referrer: t.String(),
        referee: t.String(),
        user: t.String(),
    }),
});

const CampaignStatsSchema = t.Object({
    campaignId: t.String(),
    campaignName: t.String(),
    status: t.Union([
        t.Literal("draft"),
        t.Literal("active"),
        t.Literal("paused"),
        t.Literal("archived"),
    ]),
    impressions: t.Number(),
    conversions: t.Number(),
    conversionRate: t.Number(),
    rewardsDistributed: RewardStatsSchema,
    budgetUsed: t.Record(
        t.String(),
        t.Object({ used: t.Number(), limit: t.Number() })
    ),
});

export const campaignStatsRoutes = new Elysia({ prefix: "/:merchantId/campaigns" })
    .use(businessSessionContext)
    .get(
        "/stats",
        async ({ params: { merchantId }, query, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const dateRange = query.from && query.to
                ? { from: new Date(query.from), to: new Date(query.to) }
                : undefined;

            const stats = await statsRepository.getStatsByMerchant(merchantId, dateRange);

            // Aggregate totals across all campaigns
            const totals = {
                impressions: stats.reduce((sum, s) => sum + s.impressions, 0),
                conversions: stats.reduce((sum, s) => sum + s.conversions, 0),
                rewardsTotal: stats
                    .reduce((sum, s) => sum + BigInt(s.rewardsDistributed.total), 0n)
                    .toString(),
            };

            return {
                campaigns: stats,
                totals,
                dateRange: dateRange
                    ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
                    : null,
            };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            query: t.Object({
                from: t.Optional(t.String({ format: "date-time" })),
                to: t.Optional(t.String({ format: "date-time" })),
            }),
            response: {
                200: t.Object({
                    campaigns: t.Array(CampaignStatsSchema),
                    totals: t.Object({
                        impressions: t.Number(),
                        conversions: t.Number(),
                        rewardsTotal: t.String(),
                    }),
                    dateRange: t.Union([
                        t.Object({ from: t.String(), to: t.String() }),
                        t.Null(),
                    ]),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/:campaignId/stats",
        async ({ params: { merchantId, campaignId }, query, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const dateRange = query.from && query.to
                ? { from: new Date(query.from), to: new Date(query.to) }
                : undefined;

            const stats = await statsRepository.getStatsByCampaign(campaignId, dateRange);
            if (!stats) {
                return status(404, "Campaign not found");
            }

            return stats;
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            query: t.Object({
                from: t.Optional(t.String({ format: "date-time" })),
                to: t.Optional(t.String({ format: "date-time" })),
            }),
            response: {
                200: CampaignStatsSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
```

#### Response Shape

```typescript
// GET /business/merchant/:merchantId/campaigns/stats
{
    campaigns: Array<{
        campaignId: string;
        campaignName: string;
        status: "draft" | "active" | "paused" | "archived";
        impressions: number;
        conversions: number;
        conversionRate: number; // percentage
        rewardsDistributed: {
            total: string;      // BigInt as string
            pending: string;
            settled: string;
            byRecipient: {
                referrer: string;
                referee: string;
                user: string;
            };
        };
        budgetUsed: Record<string, { used: number; limit: number }>;
    }>;
    totals: {
        impressions: number;
        conversions: number;
        rewardsTotal: string;
    };
    dateRange: { from: string; to: string } | null;
}
```

#### Known Issues & Considerations

1. **Performance**: Current implementation makes multiple DB queries. Consider:
   - Adding indexes on `(merchantId, createdAt)` for date-range queries
   - Using CTEs or materialized views for complex aggregations
   - Caching stats with short TTL (1-5 minutes)

2. **Context wiring (avoid `new Repository()` in routes)**:
   - This repo follows a domain `context.ts` pattern for singleton composition.
   - Prefer adding new repositories/services to the appropriate `{Domain}Context` immediately, instead of instantiating them inside route files “temporarily”.
   - This prevents hidden state, improves testability, and keeps cross-domain rules clear.

3. **Campaign-specific vs Merchant-wide stats**: Current impressions/conversions are merchant-wide, not per-campaign. To get per-campaign metrics, need to:
   - Link touchpoints to campaigns (add `campaignRuleId` to touchpoints?)
   - Or infer from reward attribution chain

4. **Time series data**: For charts, add endpoint:
   ```
   GET /business/merchant/:merchantId/campaigns/stats/timeseries
   ?interval=day|week|month&from=...&to=...
   ```

---

### 2.2 Member Management

**Routes**:
- `GET /business/merchant/:merchantId/members` - Paginated list
- `GET /business/merchant/:merchantId/members/count` - Quick count

#### Files to Create/Modify

1. **`services/backend/src/api/business/routes/merchant/members.ts`** (new)
   - Paginated member list with filters
   - Count endpoint for dashboard widgets

2. **`services/backend/src/domain/identity/repositories/MemberRepository.ts`** (new)
   - Query members by merchant via `interaction_logs` and `identity_nodes`
   - Aggregate per-member stats

3. **`services/backend/src/api/business/routes/merchant/index.ts`** (modify)
   - Import and `.use(memberRoutes)`

#### Data Model

Members are identified through the identity graph:

| Table | Linkage |
|-------|---------|
| `identity_nodes` | `merchantId` + `groupId` (merchant_customer type) |
| `interaction_logs` | `merchantId` + `identityGroupId` |
| `touchpoints` | `merchantId` + `identityGroupId` |
| `asset_logs` | `merchantId` + `identityGroupId` |

#### Query Implementation (MemberRepository)

```typescript
// services/backend/src/domain/identity/repositories/MemberRepository.ts
import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { Address } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import { interactionLogsTable, assetLogsTable } from "../../rewards/db/schema";
import { identityNodesTable, identityGroupsTable } from "../db/schema";

export type MemberFilter = {
    hasWallet?: boolean;
    interactionType?: "referral_arrival" | "purchase" | "wallet_connect";
    since?: Date;
    until?: Date;
};

export type MemberSummary = {
    identityGroupId: string;
    wallet: Address | null;
    firstInteractionAt: Date;
    lastInteractionAt: Date;
    interactionCount: number;
    totalRewards: string;
    hasWallet: boolean;
};

export class MemberRepository {
    /**
     * Count unique members (identity groups) for a merchant
     */
    async countByMerchant(
        merchantId: string,
        filter?: MemberFilter
    ): Promise<number> {
        const conditions = [
            eq(interactionLogsTable.merchantId, merchantId),
            isNotNull(interactionLogsTable.identityGroupId),
        ];

        if (filter?.interactionType) {
            conditions.push(eq(interactionLogsTable.type, filter.interactionType));
        }
        if (filter?.since) {
            conditions.push(gte(interactionLogsTable.createdAt, filter.since));
        }
        if (filter?.until) {
            conditions.push(lte(interactionLogsTable.createdAt, filter.until));
        }

        const [result] = await db
            .select({
                count: sql<number>`count(distinct ${interactionLogsTable.identityGroupId})::int`,
            })
            .from(interactionLogsTable)
            .where(and(...conditions));

        let memberCount = result?.count ?? 0;

        // Filter by wallet presence if needed
        if (filter?.hasWallet !== undefined) {
            const withWallet = await this.countWithWallet(merchantId, filter);
            memberCount = filter.hasWallet ? withWallet : memberCount - withWallet;
        }

        return memberCount;
    }

    private async countWithWallet(
        merchantId: string,
        filter?: MemberFilter
    ): Promise<number> {
        const interactionConditions = [
            eq(interactionLogsTable.merchantId, merchantId),
            isNotNull(interactionLogsTable.identityGroupId),
        ];

        if (filter?.since) {
            interactionConditions.push(gte(interactionLogsTable.createdAt, filter.since));
        }
        if (filter?.until) {
            interactionConditions.push(lte(interactionLogsTable.createdAt, filter.until));
        }

        const [result] = await db
            .select({
                count: sql<number>`count(distinct ${interactionLogsTable.identityGroupId})::int`,
            })
            .from(interactionLogsTable)
            .innerJoin(
                identityNodesTable,
                and(
                    eq(identityNodesTable.groupId, interactionLogsTable.identityGroupId),
                    eq(identityNodesTable.identityType, "wallet")
                )
            )
            .where(and(...interactionConditions));

        return result?.count ?? 0;
    }

    /**
     * Get paginated list of members with stats
     */
    async findByMerchant(
        merchantId: string,
        options: { limit: number; offset: number; filter?: MemberFilter }
    ): Promise<MemberSummary[]> {
        const { limit, offset, filter } = options;

        // Get distinct identity groups with interaction stats
        const conditions = [
            eq(interactionLogsTable.merchantId, merchantId),
            isNotNull(interactionLogsTable.identityGroupId),
        ];

        if (filter?.interactionType) {
            conditions.push(eq(interactionLogsTable.type, filter.interactionType));
        }
        if (filter?.since) {
            conditions.push(gte(interactionLogsTable.createdAt, filter.since));
        }
        if (filter?.until) {
            conditions.push(lte(interactionLogsTable.createdAt, filter.until));
        }

        // Step 1: Get member groups with interaction stats
        const memberGroups = await db
            .select({
                identityGroupId: interactionLogsTable.identityGroupId,
                firstInteractionAt: sql<Date>`min(${interactionLogsTable.createdAt})`,
                lastInteractionAt: sql<Date>`max(${interactionLogsTable.createdAt})`,
                interactionCount: count(),
            })
            .from(interactionLogsTable)
            .where(and(...conditions))
            .groupBy(interactionLogsTable.identityGroupId)
            .orderBy(desc(sql`max(${interactionLogsTable.createdAt})`))
            .limit(limit)
            .offset(offset);

        if (memberGroups.length === 0) return [];

        const groupIds = memberGroups
            .map((m) => m.identityGroupId)
            .filter((id): id is string => id !== null);

        // Step 2: Get wallet addresses for these groups
        const wallets = await db
            .select({
                groupId: identityNodesTable.groupId,
                wallet: identityNodesTable.identityValue,
            })
            .from(identityNodesTable)
            .where(
                and(
                    sql`${identityNodesTable.groupId} = ANY(${groupIds})`,
                    eq(identityNodesTable.identityType, "wallet")
                )
            );

        const walletMap = new Map(wallets.map((w) => [w.groupId, w.wallet as Address]));

        // Step 3: Get reward totals for these groups
        const rewards = await db
            .select({
                identityGroupId: assetLogsTable.identityGroupId,
                totalAmount: sql<string>`sum(${assetLogsTable.amount})`,
            })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.merchantId, merchantId),
                    sql`${assetLogsTable.identityGroupId} = ANY(${groupIds})`
                )
            )
            .groupBy(assetLogsTable.identityGroupId);

        const rewardMap = new Map(rewards.map((r) => [r.identityGroupId, r.totalAmount]));

        // Step 4: Filter by wallet presence if needed
        let filteredMembers = memberGroups;
        if (filter?.hasWallet !== undefined) {
            filteredMembers = memberGroups.filter((m) => {
                const hasWallet = walletMap.has(m.identityGroupId!);
                return filter.hasWallet ? hasWallet : !hasWallet;
            });
        }

        // Step 5: Combine results
        return filteredMembers.map((m) => ({
            identityGroupId: m.identityGroupId!,
            wallet: walletMap.get(m.identityGroupId!) ?? null,
            firstInteractionAt: m.firstInteractionAt,
            lastInteractionAt: m.lastInteractionAt,
            interactionCount: m.interactionCount,
            totalRewards: rewardMap.get(m.identityGroupId!) ?? "0",
            hasWallet: walletMap.has(m.identityGroupId!),
        }));
    }
}
```

#### Route Implementation

```typescript
// services/backend/src/api/business/routes/merchant/members.ts
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";

// Instantiate repository (add to IdentityContext in production)
import { MemberRepository } from "../../../../domain/identity/repositories/MemberRepository";
const memberRepository = new MemberRepository();

const MemberSummarySchema = t.Object({
    identityGroupId: t.String(),
    wallet: t.Union([t.Address(), t.Null()]),
    firstInteractionAt: t.String(),
    lastInteractionAt: t.String(),
    interactionCount: t.Number(),
    totalRewards: t.String(),
    hasWallet: t.Boolean(),
});

const MemberFilterSchema = t.Object({
    hasWallet: t.Optional(t.Boolean()),
    interactionType: t.Optional(
        t.Union([
            t.Literal("referral_arrival"),
            t.Literal("purchase"),
            t.Literal("wallet_connect"),
        ])
    ),
    since: t.Optional(t.String({ format: "date-time" })),
    until: t.Optional(t.String({ format: "date-time" })),
});

export const memberRoutes = new Elysia({ prefix: "/:merchantId/members" })
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, query, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const { limit = 50, offset = 0, ...filterParams } = query;
            const filter = {
                hasWallet: filterParams.hasWallet,
                interactionType: filterParams.interactionType,
                since: filterParams.since ? new Date(filterParams.since) : undefined,
                until: filterParams.until ? new Date(filterParams.until) : undefined,
            };

            const [members, total] = await Promise.all([
                memberRepository.findByMerchant(merchantId, { limit, offset, filter }),
                memberRepository.countByMerchant(merchantId, filter),
            ]);

            return {
                members: members.map((m) => ({
                    ...m,
                    firstInteractionAt: m.firstInteractionAt.toISOString(),
                    lastInteractionAt: m.lastInteractionAt.toISOString(),
                })),
                pagination: { total, offset, limit },
            };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            query: t.Composite([
                t.Object({
                    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                    offset: t.Optional(t.Number({ minimum: 0 })),
                }),
                MemberFilterSchema,
            ]),
            response: {
                200: t.Object({
                    members: t.Array(MemberSummarySchema),
                    pagination: t.Object({
                        total: t.Number(),
                        offset: t.Number(),
                        limit: t.Number(),
                    }),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/count",
        async ({ params: { merchantId }, query, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const filter = {
                hasWallet: query.hasWallet,
                interactionType: query.interactionType,
                since: query.since ? new Date(query.since) : undefined,
                until: query.until ? new Date(query.until) : undefined,
            };

            const [total, withWallet, withoutWallet] = await Promise.all([
                memberRepository.countByMerchant(merchantId, filter),
                memberRepository.countByMerchant(merchantId, { ...filter, hasWallet: true }),
                memberRepository.countByMerchant(merchantId, { ...filter, hasWallet: false }),
            ]);

            return { total, withWallet, withoutWallet };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            query: MemberFilterSchema,
            response: {
                200: t.Object({
                    total: t.Number(),
                    withWallet: t.Number(),
                    withoutWallet: t.Number(),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    );
```

#### Response Shapes

```typescript
// GET /business/merchant/:merchantId/members
{
    members: Array<{
        identityGroupId: string;
        wallet: Address | null;
        firstInteractionAt: string; // ISO date
        lastInteractionAt: string;  // ISO date
        interactionCount: number;
        totalRewards: string;       // BigInt as string
        hasWallet: boolean;
    }>;
    pagination: { total: number; offset: number; limit: number };
}

// GET /business/merchant/:merchantId/members/count
{
    total: number;
    withWallet: number;
    withoutWallet: number;
}
```

#### Known Issues & Considerations

1. **Performance**: Multiple queries for wallet/reward enrichment. Consider:
   - Using a single CTE/subquery approach
   - Adding indexes on `(merchantId, identityGroupId)` for interaction_logs
   - Caching count results

2. **Privacy**: Wallet addresses are exposed. Consider:
   - Adding permission check for wallet visibility
   - Masking addresses (show first/last chars only)

3. **Pagination after filtering**: Current `hasWallet` filter happens in-memory after DB fetch. For large datasets, push to DB:
   ```sql
   SELECT DISTINCT il.identity_group_id
   FROM interaction_logs il
   LEFT JOIN identity_nodes n ON n.group_id = il.identity_group_id AND n.identity_type = 'wallet'
   WHERE il.merchant_id = ? AND n.id IS [NOT] NULL
   ```

---

### 2.3 Attached Campaigns

**Route**: `GET /business/merchant/:merchantId/products/:productId/campaigns`

> **Note**: In the current data model, merchants have a single `productId` (blockchain product). This endpoint may be for future multi-product support or for filtering campaigns by product association.

#### Files to Modify

1. **`services/backend/src/api/business/routes/merchant/campaigns.ts`** (modify)
   - Add route for product-specific campaigns
   - Filter by product association (if campaigns support this)

#### Current Limitation

The current `campaign_rules` table doesn't have a `productId` field - campaigns belong to merchants, not products. Options:

**Option A**: Add `productId` to campaigns (requires migration)
```sql
ALTER TABLE campaign_rules ADD COLUMN product_id UUID;
```

**Option B**: Use merchant's single productId as filter
```typescript
// campaigns.ts - add route
.get(
    "/:merchantId/products/:productId/campaigns",
    async ({ params, businessSession }) => {
        // Verify productId matches merchant
        const merchant = await MerchantContext.repositories.merchants.findById(params.merchantId);
        if (!merchant || merchant.productId !== params.productId) {
            return status(404, "Product not found");
        }

        // Return all campaigns for this merchant (since 1:1 with product)
        return CampaignContext.services.management.getByMerchant(params.merchantId);
    }
)
```

**Option C**: Defer until multi-product support is needed

#### Recommendation

Defer Phase 2.3 implementation until product-campaign relationship is clarified. Current priority should be:
1. Campaign Stats (2.1) ✅ documented
2. Member Management (2.2) ✅ documented
3. Attached Campaigns (2.3) - needs product model clarification

---

### Phase 2 Verification

#### Automated tests
```bash
cd services/backend
bun run typecheck
bun run test
```

#### Manual tests
```bash
# Campaign Stats
curl -X GET "http://localhost:3000/business/merchant/{id}/campaigns/stats" \
  -H "x-business-auth: <JWT>"

curl -X GET "http://localhost:3000/business/merchant/{id}/campaigns/stats?from=2026-01-01&to=2026-01-31" \
  -H "x-business-auth: <JWT>"

# Member Management
curl -X GET "http://localhost:3000/business/merchant/{id}/members?limit=10" \
  -H "x-business-auth: <JWT>"

curl -X GET "http://localhost:3000/business/merchant/{id}/members/count?hasWallet=true" \
  -H "x-business-auth: <JWT>"
```

#### Validation criteria
- [ ] Campaign stats return correct aggregations from interaction_logs/asset_logs
- [ ] Date range filtering works for stats
- [ ] Member list pagination works correctly
- [ ] Member count matches distinct identity groups
- [ ] hasWallet filter correctly identifies wallet-linked users
- [ ] Authorization checks pass/fail appropriately
- [ ] Response schemas match Eden Treaty types
- [ ] New endpoints avoid ad-hoc DI (repositories/services wired via domain `context.ts`)
- [ ] Basic performance sanity: p95 latency stays within target thresholds for expected dataset sizes (add caching/indexes if not)

---

## Phase 3: Migrate TanStack Start Logic to Backend

**Goal**: Move all server-side business logic from `apps/business/src/context/` to `services/backend/`, transforming the dashboard into a pure API client using Eden Treaty.

### Current Architecture (TanStack Start)

```
apps/business/src/context/
├── campaigns/
│   ├── action/           # Server functions (createServerFn)
│   │   ├── getCampaigns.ts       # MongoDB + indexer + blockchain multicall
│   │   ├── getCampaignsStats.ts  # Indexer API + token info
│   │   ├── createOnChain.ts      # Blockchain tx preparation
│   │   ├── getAttachedCampaigns.ts # Blockchain readContract
│   │   └── ...
│   └── repository/
│       └── CampaignRepository.ts # Direct MongoDB access
├── product/action/       # Indexer API pass-through
├── members/action/       # Indexer API pass-through
├── common/mongoDb.ts     # MongoDB connection
└── blockchain/provider.ts # Viem client
```

### Target Architecture (Elysia Backend)

```
services/backend/src/
├── api/business/routes/merchant/
│   ├── campaigns.ts      # ✅ Exists (CRUD)
│   ├── campaignStats.ts  # 🆕 Phase 2.1
│   ├── campaignTx.ts     # 🆕 Phase 3.1 (prepare-tx)
│   ├── members.ts        # 🆕 Phase 2.2
│   └── products.ts       # 🆕 Phase 3.2
├── domain/campaign/      # ✅ Exists (PostgreSQL)
└── infrastructure/
    └── blockchain/       # 🆕 Phase 3 (Viem calls)
```

---

### 3.1 Campaign Management

#### Migration Status

| TanStack Start Action | Backend Endpoint | Status |
|-----------------------|------------------|--------|
| `getMyCampaigns()` | `GET /merchant/:id/campaigns` | ✅ Exists |
| `getMyCampaignsStats()` | `GET /merchant/:id/campaigns/stats` | 🆕 Phase 2.1 |
| `getCampaignDetails()` | `GET /merchant/:id/campaigns/:campaignId` | ✅ Exists |
| `saveCampaignDraft()` | `POST /merchant/:id/campaigns` | ✅ Exists |
| `updateCampaignState()` | `PUT /merchant/:id/campaigns/:campaignId` | ✅ Exists |
| `getCreationData()` | `POST /merchant/:id/campaigns/:campaignId/prepare-tx` | 🆕 Below |
| `deleteCampaign()` | `DELETE /merchant/:id/campaigns/:campaignId` | ✅ Exists |
| `getAttachedCampaigns()` | `GET /merchant/:id/campaigns/attached` | 🆕 Below |

#### 3.1.1 Campaign Transaction Preparation Endpoint (NEW)

**Route**: `POST /business/merchant/:merchantId/campaigns/:campaignId/prepare-tx`

**Purpose**: Prepare blockchain transaction data for deploying a campaign on-chain. Frontend executes the transaction, backend updates state on confirmation.

**Files to Create**:
1. `services/backend/src/api/business/routes/merchant/campaignTx.ts`
2. `services/backend/src/domain/campaign/services/CampaignDeploymentService.ts`
3. `services/backend/src/infrastructure/blockchain/campaignFactory.ts`

##### Current Logic (from `createOnChain.ts`)

The TanStack Start action:
1. Validates campaign has triggers and bank address
2. Computes cap period from budget type
3. Fetches token decimals and exchange rate
4. Builds campaign init data (fixed or range distribution)
5. Simulates contract deployment to get deterministic address
6. Returns encoded calldata for two transactions:
   - Deploy campaign via `productInteractionManager.deployCampaign()`
   - Authorize campaign in bank via `campaignBank.updateCampaignAuthorisation()`

##### Service Implementation

```typescript
// services/backend/src/domain/campaign/services/CampaignDeploymentService.ts
import {
    addresses,
    campaignBankAbi,
    productInteractionManagerAbi,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import { interactionTypes } from "@frak-labs/core-sdk";
import type { Address, Hex } from "viem";
import {
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    parseUnits,
} from "viem";
import { simulateContract } from "viem/actions";
import { viemClient } from "../../../infrastructure/blockchain/client";
import { pricingRepository } from "../../../infrastructure/pricing";
import type { CampaignRuleSelect } from "../db/schema";

type PreparedTransaction = {
    to: Address;
    data: Hex;
};

export type CampaignDeploymentResult = {
    transactions: PreparedTransaction[];
    estimatedCampaignAddress: Address;
};

// Campaign config struct for ABI encoding (fixed rewards)
const affiliationFixedCampaignConfigStruct = [
    { name: "name", type: "bytes32" },
    { name: "bank", type: "address" },
    { name: "capConfig", type: "tuple", components: [
        { name: "period", type: "uint48" },
        { name: "amount", type: "uint256" },
    ]},
    { name: "activationPeriod", type: "tuple", components: [
        { name: "start", type: "uint48" },
        { name: "end", type: "uint48" },
    ]},
    { name: "chainingConfig", type: "tuple", components: [
        { name: "userPercent", type: "uint256" },
        { name: "deperditionPerLevel", type: "uint256" },
    ]},
    { name: "triggers", type: "tuple[]", components: [
        { name: "interactionType", type: "bytes32" },
        { name: "baseReward", type: "uint256" },
        { name: "maxCountPerUser", type: "uint256" },
    ]},
] as const;

// Campaign identifier for fixed reward type
const affiliationFixedCampaignId = "0x..." as Hex; // Import from app-essentials

export class CampaignDeploymentService {
    /**
     * Prepare transaction data for deploying a campaign on-chain
     */
    async prepareCampaignDeployment(
        campaign: CampaignRuleSelect,
        merchantBankAddress: Address,
        deployerWallet: Address
    ): Promise<CampaignDeploymentResult> {
        // Validate campaign has rewards defined
        const rewards = campaign.rule.rewards;
        if (!rewards || rewards.length === 0) {
            throw new Error("Campaign must have at least one reward defined");
        }

        // Get token info for the bank
        const tokenInfo = await this.getTokenInfo(merchantBankAddress);

        // Get token exchange rate if needed
        const tokenRate = await pricingRepository.getTokenPrice({
            token: tokenInfo.address,
        });
        if (!tokenRate) {
            throw new Error("Could not fetch token price");
        }

        // Build campaign initialization data
        const initData = this.buildCampaignInitData(campaign, {
            bankAddress: merchantBankAddress,
            tokenDecimals: tokenInfo.decimals,
            tokenRate: tokenRate.eur,
        });

        // Simulate to get deterministic campaign address
        const { result: campaignAddress } = await simulateContract(viemClient, {
            account: deployerWallet,
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "deployCampaign",
            args: initData.args,
        });

        // Build transaction array
        const transactions: PreparedTransaction[] = [
            // 1. Deploy campaign
            {
                to: addresses.productInteractionManager,
                data: encodeFunctionData({
                    abi: productInteractionManagerAbi,
                    functionName: "deployCampaign",
                    args: initData.args,
                }),
            },
            // 2. Authorize campaign in bank
            {
                to: merchantBankAddress,
                data: encodeFunctionData({
                    abi: campaignBankAbi,
                    functionName: "updateCampaignAuthorisation",
                    args: [campaignAddress, true],
                }),
            },
        ];

        return {
            transactions,
            estimatedCampaignAddress: campaignAddress,
        };
    }

    private async getTokenInfo(bankAddress: Address) {
        // Read token address and decimals from bank contract
        // Implementation depends on existing infrastructure
        return {
            address: "0x..." as Address,
            decimals: 6,
        };
    }

    private buildCampaignInitData(
        campaign: CampaignRuleSelect,
        config: {
            bankAddress: Address;
            tokenDecimals: number;
            tokenRate: number;
        }
    ) {
        const { bankAddress, tokenDecimals, tokenRate } = config;

        // Convert fiat amount to token amount
        const fiatToToken = (amount: number) => {
            const tokenAmount = amount / tokenRate;
            return parseUnits(tokenAmount.toString(), tokenDecimals);
        };

        // Compute cap period from budget config
        const capPeriod = this.computeCapPeriod(campaign.budgetConfig);

        // Build triggers from reward definitions
        const triggers = campaign.rule.rewards
            .filter((r) => r.type === "token" && r.amountType === "fixed")
            .map((reward) => ({
                interactionType: this.mapTriggerToInteractionType(campaign.rule.trigger),
                baseReward: fiatToToken((reward as { amount: number }).amount * 0.8), // 20% commission
                maxCountPerUser: 1n,
            }));

        // Build init data
        const campaignInitData = encodeAbiParameters(
            affiliationFixedCampaignConfigStruct,
            [
                stringToBytes32(campaign.name),
                bankAddress,
                { period: capPeriod, amount: 0n }, // TODO: compute from budget
                { start: 0, end: 0 }, // TODO: from campaign schedule
                { userPercent: 1000n, deperditionPerLevel: 8000n }, // defaults
                triggers,
            ]
        );

        // Add offset for dynamic data
        const initDataWithOffset = concatHex([
            "0x0000000000000000000000000000000000000000000000000000000000000020",
            campaignInitData,
        ]);

        return {
            args: [
                BigInt(campaign.merchantId), // TODO: need productId mapping
                affiliationFixedCampaignId,
                initDataWithOffset,
            ] as const,
        };
    }

    private computeCapPeriod(budgetConfig: unknown): number {
        // Map budget type to seconds
        // daily = 86400, weekly = 604800, monthly = 2592000
        return 86400; // default daily
    }

    private mapTriggerToInteractionType(trigger: string): Hex {
        const mapping: Record<string, Hex> = {
            purchase: interactionTypes.purchase.completed,
            signup: interactionTypes.webshop.openned, // adjust as needed
            wallet_connect: interactionTypes.webshop.openned,
        };
        return mapping[trigger] ?? interactionTypes.webshop.openned;
    }
}
```

##### Route Implementation

```typescript
// services/backend/src/api/business/routes/merchant/campaignTx.ts
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignContext } from "../../../../domain/campaign";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";
import { CampaignDeploymentService } from "../../../../domain/campaign/services/CampaignDeploymentService";

const deploymentService = new CampaignDeploymentService();

const TransactionSchema = t.Object({
    to: t.Address(),
    data: t.Hex(),
});

export const campaignTxRoutes = new Elysia({ prefix: "/:merchantId/campaigns" })
    .use(businessSessionContext)
    .post(
        "/:campaignId/prepare-tx",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            // Check authorization
            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // Get campaign
            const campaign = await CampaignContext.services.management.getById(campaignId);
            if (!campaign || campaign.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            // Check campaign is in draft status
            if (campaign.status !== "draft") {
                return status(400, "Campaign must be in draft status to deploy");
            }

            // Get merchant bank address
            const merchant = await MerchantContext.repositories.merchants.findById(merchantId);
            if (!merchant?.bankAddress) {
                return status(400, "Merchant has no bank address configured");
            }

            try {
                const result = await deploymentService.prepareCampaignDeployment(
                    campaign,
                    merchant.bankAddress,
                    businessSession.wallet
                );

                return {
                    transactions: result.transactions,
                    estimatedCampaignAddress: result.estimatedCampaignAddress,
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : "Deployment preparation failed";
                return status(400, message);
            }
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: t.Object({
                    transactions: t.Array(TransactionSchema),
                    estimatedCampaignAddress: t.Address(),
                }),
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/:campaignId/confirm-deployment",
        async ({ params: { merchantId, campaignId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await MerchantContext.services.authorization.hasAccess(
                merchantId,
                businessSession.wallet
            );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // Update campaign status and store on-chain address
            const result = await CampaignContext.services.management.publish(campaignId);
            if (!result.success) {
                return status(400, result.error);
            }

            // TODO: Store the on-chain campaign address
            // This may require schema update to campaign_rules table

            return { success: true, campaign: result.campaign };
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            body: t.Object({
                txHash: t.Hex(),
                campaignAddress: t.Address(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                    campaign: t.Any(), // CampaignResponseSchema
                }),
                400: t.String(),
                401: t.String(),
                403: t.String(),
            },
        }
    );
```

#### 3.1.2 Attached Campaigns Endpoint (NEW)

**Route**: `GET /business/merchant/:merchantId/campaigns/attached`

**Purpose**: Get list of campaigns currently attached to a product's interaction contract on-chain.

```typescript
// Add to services/backend/src/api/business/routes/merchant/campaigns.ts
.get(
    "/attached",
    async ({ params: { merchantId }, businessSession }) => {
        if (!businessSession) {
            return status(401, "Authentication required");
        }

        const hasAccess = await MerchantContext.services.authorization.hasAccess(
            merchantId,
            businessSession.wallet
        );
        if (!hasAccess) {
            return status(403, "Access denied");
        }

        // Get merchant's productId
        const merchant = await MerchantContext.repositories.merchants.findById(merchantId);
        if (!merchant?.productId) {
            return { campaigns: [] };
        }

        // Read attached campaigns from blockchain
        const interactionContract = await readContract(viemClient, {
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "getInteractionContract",
            args: [BigInt(merchant.productId)],
        });

        const attachedAddresses = await readContract(viemClient, {
            address: interactionContract,
            abi: productInteractionDiamondAbi,
            functionName: "getCampaigns",
        });

        return { campaigns: attachedAddresses };
    },
    {
        params: t.Object({ merchantId: t.String() }),
        response: {
            200: t.Object({
                campaigns: t.Array(t.Address()),
            }),
            401: t.String(),
            403: t.String(),
        },
    }
)
```

---

### 3.2 Product/Role Management

#### Migration Status

| TanStack Start Action | Backend Endpoint | Status |
|-----------------------|------------------|--------|
| `getMyProducts()` | `GET /business/merchant/my` | ✅ Exists (needs enrichment) |
| `getRolesOnProduct()` | Include in `/my` response | ✅ Via existing endpoint |
| `getProductAdministrators()` | `GET /business/merchant/:id/admins` | ⚠️ Needs role details |

#### 3.2.1 Enrich Admin Endpoint with Role Details

**Current**: `GET /business/merchant/:merchantId/admins` returns only `wallet` + `addedBy`

**Required**: Add detailed role flags (campaignManager, interactionManager, etc.)

**Modify**: `services/backend/src/api/business/routes/merchant/admins.ts`

```typescript
// Enhanced admin response with role details
const AdminWithRolesSchema = t.Object({
    wallet: t.Address(),
    addedBy: t.Address(),
    addedAt: t.String(),
    isOwner: t.Boolean(),
    roles: t.Object({
        productAdministrator: t.Boolean(),
        interactionManager: t.Boolean(),
        campaignManager: t.Boolean(),
        purchaseOracleUpdater: t.Boolean(),
    }),
});

// In the route handler, parse roles bitmask:
const parseRoles = (rolesMask: bigint) => ({
    productAdministrator: (rolesMask & productRoles.productAdministrator) !== 0n,
    interactionManager: (rolesMask & productRoles.interactionManager) !== 0n,
    campaignManager: (rolesMask & productRoles.campaignManager) !== 0n,
    purchaseOracleUpdater: (rolesMask & productRoles.purchaseOracleUpdater) !== 0n,
});
```

> **Note**: Current implementation may need to call indexer API for role bitmask. Consider caching or moving role data to PostgreSQL.

---

### 3.3 Member Management

**Status**: ✅ Fully documented in Phase 2.2

The member endpoints (`GET /members` and `GET /members/count`) defined in Phase 2.2 replace:
- `getProductMembers()` → `GET /business/merchant/:merchantId/members`
- `getProductsMembersCount()` → `GET /business/merchant/:merchantId/members/count`

---

### 3.4 Data Migration: MongoDB → PostgreSQL

#### Current MongoDB Schema (`campaigns` collection)

```typescript
// apps/business/src/context/campaigns/dto/CampaignDocument.ts
type CampaignDocument = {
    _id: ObjectId;
    creator: Address;
    productId?: Hex;
    title: string;
    type?: Goal;
    // ... campaign config ...
    state:
        | { key: "draft" }
        | { key: "created"; address: Address; txHash: Hex }
        | { key: "creationFailed"; error: string };
};
```

#### Target PostgreSQL Schema (`campaign_rules` table)

The existing `campaign_rules` table already handles most fields:

| MongoDB Field | PostgreSQL Field | Notes |
|---------------|------------------|-------|
| `_id` | `id` (UUID) | Auto-generated |
| `creator` | - | Derive from `merchantId` owner |
| `productId` | - | Derive from merchant's `productId` |
| `title` | `name` | Direct mapping |
| `type` (goal) | `metadata.goal` | In JSONB |
| `state.address` | `onchainAddress` | **NEW COLUMN NEEDED** |
| `state.txHash` | `deploymentTxHash` | **NEW COLUMN NEEDED** |
| `triggers` | `rule.rewards` | Transformed structure |

#### Schema Migration (if needed)

```sql
-- Add on-chain deployment tracking to campaign_rules
ALTER TABLE campaign_rules
ADD COLUMN onchain_address VARCHAR(42),
ADD COLUMN deployment_tx_hash VARCHAR(66),
ADD COLUMN deployment_status VARCHAR(20) DEFAULT 'pending';

-- Index for on-chain lookups
CREATE INDEX campaign_rules_onchain_address_idx ON campaign_rules(onchain_address);
```

#### Migration Strategy

1. **Keep MongoDB read-only** during transition
2. **Dual-write new campaigns** to both stores
3. **Backfill existing campaigns** from MongoDB to PostgreSQL
4. **Remove MongoDB dependency** after verification

---

### Phase 3 Implementation Order

1. ✅ Campaign CRUD (already exists)
2. 🆕 `prepare-tx` endpoint (3.1.1) - highest complexity
3. 🆕 `confirm-deployment` endpoint (3.1.1)
4. 🆕 `attached` campaigns endpoint (3.1.2)
5. ⚠️ Enrich admins endpoint with roles (3.2.1)
6. ✅ Members endpoints (Phase 2.2)
7. 📋 Data migration script (3.4)

---

### Phase 3 Verification

#### Automated tests
```bash
cd services/backend
bun run typecheck
bun run test
```

#### Manual tests
```bash
# Prepare campaign deployment
curl -X POST "http://localhost:3000/business/merchant/{id}/campaigns/{campaignId}/prepare-tx" \
  -H "x-business-auth: <JWT>"

# Get attached campaigns
curl -X GET "http://localhost:3000/business/merchant/{id}/campaigns/attached" \
  -H "x-business-auth: <JWT>"
```

#### Validation criteria
- [ ] `prepare-tx` returns valid transaction data for wallet signing
- [ ] Simulated contract deployment succeeds
- [ ] `confirm-deployment` updates campaign status correctly
- [ ] Attached campaigns list matches on-chain state
- [ ] Admin roles are correctly parsed from bitmask
- [ ] No regression on existing campaign CRUD endpoints

---

## Phase 4: Dashboard Cleanup

**Goal**: Remove server-side logic from dashboard, convert to pure API client.

### 4.1 Files to Delete

After backend endpoints are verified, remove these files from `apps/business/`:

#### Campaign Server Actions (7 files)
```
src/context/campaigns/action/getCampaigns.ts        # → GET /merchant/:id/campaigns
src/context/campaigns/action/getCampaignsStats.ts   # → GET /merchant/:id/campaigns/stats
src/context/campaigns/action/getDetails.ts          # → GET /merchant/:id/campaigns/:id
src/context/campaigns/action/createCampaign.ts      # → POST /merchant/:id/campaigns
src/context/campaigns/action/createOnChain.ts       # → POST /merchant/:id/campaigns/:id/prepare-tx
src/context/campaigns/action/deleteCampaign.ts      # → DELETE /merchant/:id/campaigns/:id
src/context/campaigns/action/getAttachedCampaigns.ts # → GET /merchant/:id/campaigns/attached
src/context/campaigns/action/getBankInfo.ts         # → Move to backend if still needed
```

#### Campaign Repository & DTO (2 files)
```
src/context/campaigns/repository/CampaignRepository.ts  # MongoDB access
src/context/campaigns/dto/CampaignDocument.ts           # MongoDB types
```

#### Product Server Actions (3 files)
```
src/context/product/action/getProducts.ts           # → GET /merchant/my
src/context/product/action/roles.ts                 # → Included in /merchant/my
src/context/product/action/getAdministrators.ts     # → GET /merchant/:id/admins
```

#### Member Server Actions (1 file)
```
src/context/members/action/getProductMembers.ts     # → GET /merchant/:id/members
```

#### Infrastructure (2 files)
```
src/context/common/mongoDb.ts                       # MongoDB connection
src/context/blockchain/provider.ts                  # Only if no longer used elsewhere
```

#### Mock Files (delete after removing actions)
```
src/context/campaigns/action/mock.ts
src/context/campaigns/action/mock.test.ts
src/context/product/action/mock.ts
src/context/product/action/mock.test.ts
src/context/members/action/mock.ts
src/context/members/action/mock.test.ts
```

### 4.2 Files to Keep

```
src/context/api/backendClient.ts    # Eden Treaty client (essential)
src/context/api/indexerApi.ts       # May still be needed for some queries
src/context/auth/authMiddleware.ts  # Session cookie handling
src/context/auth/authEnv.ts         # Auth environment config
src/context/frak-wallet/config.ts   # Wallet configuration
```

### 4.3 Migration Steps per File

For each server action removal:

1. **Identify Eden Treaty equivalent**:
   ```typescript
   // Before (server action)
   const campaigns = await getMyCampaigns();

   // After (Eden Treaty)
   const { data, error } = await authenticatedBackendApi
       .merchant({ merchantId })
       .campaigns
       .get();
   ```

2. **Update query options**:
   ```typescript
   // Before
   export const campaignsQueryOptions = () =>
       queryOptions({
           queryKey: ["campaigns"],
           queryFn: () => getMyCampaigns(),
       });

   // After
   export const campaignsQueryOptions = (merchantId: string) =>
       queryOptions({
           queryKey: ["campaigns", merchantId],
           queryFn: async () => {
               const { data, error } = await authenticatedBackendApi
                   .merchant({ merchantId })
                   .campaigns
                   .get();
               if (error) throw new Error(error.message);
               return data.campaigns;
           },
       });
   ```

3. **Update component imports**:
   ```typescript
   // Remove
   import { getMyCampaigns } from "@/context/campaigns/action/getCampaigns";

   // Keep
   import { campaignsQueryOptions } from "@/module/campaigns/queries/queryOptions";
   ```

### 4.4 Verification Checklist

Before deleting each server action:

- [ ] Backend endpoint exists and returns same data shape
- [ ] Query options updated to use Eden Treaty
- [ ] Components using the action have been updated
- [ ] No TypeScript errors after removal
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing confirms feature works

### 4.5 Cleanup Order

1. Remove mock files first (no dependencies)
2. Remove server actions one category at a time:
   - Members actions (simplest, pass-through)
   - Product actions (pass-through)
   - Campaign actions (most complex, last)
3. Remove MongoDB repository after all campaign actions gone
4. Remove `mongoDb.ts` connection file
5. Remove `provider.ts` if unused
6. Update `package.json` to remove MongoDB dependency

---

## Phase 5: Final Review & Optimization

### 5.1 Endpoint Review Checklist

| Endpoint | Schema | Auth | Errors | Tests | Docs |
|----------|--------|------|--------|-------|------|
| `GET /merchant/:id/campaigns` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `GET /merchant/:id/campaigns/stats` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `POST /merchant/:id/campaigns/:id/prepare-tx` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `GET /merchant/:id/campaigns/attached` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `GET /merchant/:id/members` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `GET /merchant/:id/members/count` | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| `GET /merchant/:id/admins` | ⚠️ Enrich | ✅ | ✅ | ⬜ | ⬜ |
| `GET /user/wallet/rewards/history` | ✅ | ✅ | ✅ | ⬜ | ⬜ |

### 5.2 Performance Optimization

After migration, review and optimize:

1. **Database Indexes**:
   ```sql
   -- Verify these indexes exist
   CREATE INDEX IF NOT EXISTS interaction_logs_merchant_created_idx
     ON interaction_logs(merchant_id, created_at);
   CREATE INDEX IF NOT EXISTS asset_logs_merchant_campaign_idx
     ON asset_logs(merchant_id, campaign_rule_id);
   ```

2. **Query Caching**:
   - Campaign stats: Cache for 1-5 minutes
   - Member counts: Cache for 30 seconds
   - Attached campaigns: Cache for 5 minutes (on-chain data)

3. **Response Compression**:
   - Enable gzip for large campaign lists
   - Paginate member lists (default 50, max 100)

### 5.3 Documentation Updates

After implementation, update these files:

1. **`FRONTEND_MIGRATION_GUIDE.md`**:
   - Add new endpoint documentation
   - Update Eden Treaty usage examples

2. **`REFACTO_PLAN.md`**:
   - Mark Phase 7 complete
   - Add notes about MongoDB removal

3. **`services/backend/README.md`**:
   - Document new business API routes
   - Add migration notes

### 5.4 Monitoring & Alerts

Set up monitoring for new endpoints:

1. **Latency thresholds**:
   - Campaign stats: < 500ms (p95)
   - Member list: < 200ms (p95)
   - Prepare-tx: < 2s (includes simulation)

2. **Error rates**:
   - Alert if > 1% 5xx errors
   - Alert if > 5% 4xx errors (excluding 401/403)

---

## Implementation Order (Updated)

### Phase 1: User Reward History ✅ DOCUMENTED
Independent, high user value. No dependencies.

### Phase 2: Business Analytics ✅ DOCUMENTED
1. Campaign Stats (2.1)
2. Member Management (2.2)
3. ~~Attached Campaigns (2.3)~~ → Moved to Phase 3

### Phase 3: Server Action Migration ✅ DOCUMENTED
1. `prepare-tx` endpoint (highest complexity)
2. `confirm-deployment` endpoint
3. `attached` campaigns endpoint
4. Enrich admins endpoint
5. Data migration script (MongoDB → PostgreSQL)

### Phase 4: Dashboard Cleanup ✅ DOCUMENTED
1. Update query options to Eden Treaty
2. Remove server actions (members → products → campaigns)
3. Remove MongoDB infrastructure
4. Remove unused dependencies

### Phase 5: Final Review ✅ DOCUMENTED
1. Endpoint verification checklist
2. Performance optimization
3. Documentation updates
4. Monitoring setup

---

## Verification (Phase 1)

### Automated tests
```bash
cd services/backend
bun run typecheck
bun run test
```

### Manual test
```bash
# Start backend in dev
cd services/backend && bun run dev

# Test the endpoint (requires valid JWT)
curl -X GET "http://localhost:3000/user/wallet/rewards/history?limit=10" \
  -H "x-wallet-auth: <JWT_TOKEN>"
```

### Validation criteria
- [ ] Query returns rewards with merchant info
- [ ] Pagination works (offset/limit + correct total count)
- [ ] Status filtering works (single and multiple statuses)
- [ ] Token metadata enriched (symbol, decimals)
- [ ] Interaction type mapped correctly (`referral_arrival` → `referral`)
- [ ] Response schema matches Eden Treaty types
- [ ] List + count queries apply the same filters (status + any scope filters like `assetType="token"`)
- [ ] No regression on existing endpoints (`/balance`, `/balance/claimable`)

---

## Post-Implementation Tasks

### Update FRONTEND_MIGRATION_GUIDE.md

Add to the User API section:

```
└── /wallet
    ├── /balance
    │   └── ...
    └── /rewards          # NEW
        └── GET /history  # Paginated reward history with merchant info
```

### Update REFACTO_PLAN.md

Mark Phase 7 deliverable as complete:
- [x] Rewards API for wallet queries

---

## Appendix: TanStack Start → Backend Query Pattern

### Example: Migrating Campaign Stats

**Before (Server Action):**
```typescript
// apps/business/src/context/campaigns/action/getCampaignsStats.ts
import { createServerFn } from "@tanstack/start";
import { mongoDb } from "@/context/common/mongoDb";

export const getMyCampaignsStats = createServerFn({ method: "GET" })
    .handler(async () => {
        const db = await mongoDb();
        // Direct MongoDB + blockchain calls
        const campaigns = await db.collection("campaigns").find({}).toArray();
        // ... complex logic
        return stats;
    });

// apps/business/src/module/campaigns/queries/queryOptions.ts
export const campaignsStatsQueryOptions = () =>
    queryOptions({
        queryKey: ["campaigns", "stats"],
        queryFn: async () => {
            return await getMyCampaignsStats();
        },
    });
```

**After (Eden Treaty → Backend):**
```typescript
// apps/business/src/module/campaigns/queries/queryOptions.ts
import { queryOptions } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";

export const campaignsStatsQueryOptions = (merchantId: string) =>
    queryOptions({
        queryKey: ["campaigns", merchantId, "stats"],
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .campaigns
                .stats
                .get();

            if (error) {
                throw new Error(error.message ?? "Failed to fetch campaign stats");
            }

            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

// Usage in component
function CampaignStatsPanel({ merchantId }: { merchantId: string }) {
    const { data: stats } = useSuspenseQuery(
        campaignsStatsQueryOptions(merchantId)
    );

    return <StatsDisplay stats={stats} />;
}

// Usage in route loader (SSR prefetch)
export const Route = createFileRoute("/_restricted/campaigns/stats")({
    loader: ({ context }) => {
        const merchantId = context.merchantId;
        return queryClient.ensureQueryData(
            campaignsStatsQueryOptions(merchantId)
        );
    },
    component: CampaignStatsPage,
});
```

### Key Differences

| Aspect | Server Action | Eden Treaty |
|--------|---------------|-------------|
| Data fetching | `createServerFn` + direct DB | `authenticatedBackendApi.*.get()` |
| Type safety | Manual types | Auto-generated from Elysia schema |
| Error handling | Try/catch | `{ data, error }` destructuring |
| Auth | Cookie middleware | `x-business-auth` header auto-inject |
| Caching | TanStack Query | TanStack Query (unchanged) |
| SSR | Works | Works (same loader pattern) |

### Eden Treaty Response Pattern

```typescript
// Eden Treaty always returns { data, error, status, headers }
const { data, error } = await authenticatedBackendApi
    .merchant({ merchantId })
    .campaigns
    .get();

// Type-safe: data is typed from Elysia response schema
// error is typed from Elysia error responses

if (error) {
    // Handle error (401 auto-handled by backendClient.ts)
    console.error(error.message);
    throw error;
}

// data is fully typed
return data.campaigns;
```
