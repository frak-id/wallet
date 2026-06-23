# TakeAds Affiliate Campaigns — Integration Plan

**Scope:** integrate third-party affiliate brands (first provider: **TakeAds** by Mitgo)
into the wallet so a hand-picked set of brands appears in the **explorer** like any
native brand. An end user can generate a **personal tracking link** (or a shareable
**coupon link**) for a brand; conversions driven by that user are tracked per-user and
rewarded from a **Frak-controlled EURe pool**, with the reward based on the brand
commission **plus an optional Frak boost**.

The guiding principle is **reuse, not rebuild**: TakeAds conversions are funneled through
the existing `interaction_logs → campaign rule → asset_logs → settlement` pipeline. No
core reward-engine changes are required — the new surface area is a TakeAds integration
module (catalog sync + link generation + conversion ingestion) plus seed data.

> **Migration SQL is db-team owned** (per `services/backend/AGENTS.md`). This plan defines
> Drizzle table/column definitions only; they stay inert until the db team generates +
> runs the migration. Flag this in the PR.

---

## 1. Locked decisions

- **Reward asset = EURe stablecoin** (not a Frak token). EURe is a standard ERC-20, so it
  drops into the existing model: it's the synthetic merchant's `defaultRewardToken` and the
  token funded in the Frak `CampaignBank`. Settlement pushes EURe unchanged.
- **Accept `PENDING` conversions** — create the reward immediately on first sighting, with
  an `availableAt` **lockup of > 1 week**. This fronting cost is treated as acquisition
  spend (same bucket as the boost).
- **Decline ⇒ discard.** If a conversion later flips to `DECLINED`, cancel the still-locked
  reward (`asset_logs.status = cancelled`, budget restored). Declines that arrive **after**
  the reward has settled on-chain are unrecoverable and written off (see §7 tradeoff).
- **SubID mapping table** — never put internal IDs in the TakeAds `subId`. A dedicated map
  isolates internal UUIDs from the external network and survives identity merges.
- **Synthetic merchant per brand** — one `merchants` row per TakeAds brand, giving each its
  own explorer card, campaign, and per-brand boost.
- **Lazy link generation behind an explicit user action** — the backend mints/owns the
  `subId`; the frontend only triggers it. One **stable** `subId` per `(user, brand)`; the
  resolved link is a re-derivable **cache**, the mapping is the source of truth.
- **One shared Frak `CampaignBank`** funded with EURe backs all synthetic brand merchants
  (nothing enforces `merchants.bank_address` uniqueness).
- **Ingestion = poll the Stats API** (`GET /v3/api/stats/action`) on a cron for the PoC;
  postbacks can be added later for latency. No public inbound endpoint to secure for v1.

---

## 2. Is it possible with TakeAds? (capability summary)

| Need | Endpoint / mechanism | Notes |
|---|---|---|
| Brand catalog + commission rates | `GET /v1/product/monetize-api/v2/merchant` | `name`, `domains`, logo, `commissionRates[{fixedCommission, percentageCommission}]`. **No** server-side brand filter — pull all, filter client-side. |
| Per-user tracking link / deeplink | `PUT /v2/resolve` (`iris[]`, `subId`) | Or append `&s=<subId>&url=<deeplink>` to the catalog's `trackingLink`. **Single** `subId` slot (~50 char safe). |
| Coupons | coupon endpoints (per-coupon `trackingLink`) | Codes are **shared/public**, not unique-per-user. Attribution rides the `subId` on the click-through link. |
| Conversion feedback | `GET /v3/api/stats/action` (pull) + Postback (push, ≤10 URLs) | Both expose `subId`, `revenue`, `commission`, `status`, `currencyCode`. |

**Stats API exposes amounts even while `PENDING`** — see §6. Both `revenue` (the buyer's
purchase amount) and `commission` (our publisher payout) are present from first sighting,
alongside `currencyCode`, `subId`, and `status`. Amounts may adjust (e.g. partial refund)
before confirmation.

**Caveats to design around:** confirmation lag of ~1–3 months (`PENDING → CONFIRMED |
DECLINED`); coupon ≠ per-user code; single `subId` slot; EUR commission vs EURe token
payout timing/float (min €20 TakeAds withdrawal); no documented sandbox or rate limits
(confirm with TakeAds).

---

## 3. Conceptual model — affiliate, not native referral

The native Frak model is **referrer → referee**, where the referee also becomes a Frak
user and converts on a Frak-SDK-equipped store (`referral_links` graph + SDK pixel/webhook).

TakeAds is a **pure affiliate model**: the Frak user is the *promoter*; the buyer is an
**anonymous external person with no Frak SDK on the brand's site**. Therefore:

- Attribution does **not** flow through `referral_links`. It flows through the TakeAds
  `subId` we control at link-generation time, resolved back via our mapping table.
- The conversion signal arrives **server-to-server from TakeAds**, not from our SDK.
- The affiliate is the **direct earner** → modeled as a campaign reward with
  `recipient: "referee"`, which `RewardCalculator` resolves to `context.user.identityGroupId`
  (the affiliate) with **no referral chain needed**.

---

## 4. Architecture

```
 (A) Catalog sync ───▶ merchants (synthetic per brand) + campaign_rules (% + boost, active)
   cron: /v2/merchant   + bank_address → ONE shared Frak EURe CampaignBank
                        └─▶ surfaces in explorer (ExplorerOrchestrator, unchanged)

 (B) Link gen ───────▶ POST /user/.../takeads/:merchantId/link   (auth, lazy, on button)
   PUT /v2/resolve      ├─ reuse/mint stable subId for (identityGroupId, merchantId)
   (subId = token)      └─ cache + return deeplink (+ coupon code for display)

 (C) Conversion ─────▶ cron polls GET /v3/api/stats/action?updatedAtFrom={watermark}
   ingestion           ├─ resolve subId → identityGroupId (mapping table)
                        ├─ PENDING/CONFIRMED → upsert "purchase" interaction
                        │     externalEventId = "takeads:{actionId}"
                        │     payload.amount = revenue
                        └─ DECLINED → cancel still-locked reward + restore budget

 (D) Reward + settle ─▶ EXISTING machinery, zero changes:
                        BatchRewardOrchestrator → RuleEngine (% of revenue + fixed boost)
                        → asset_logs (pending, availableAt = +Nd) → SettlementOrchestrator
                        → RewarderHub.batch() pulls EURe from the Frak CampaignBank
```

**Decisive enabler:** `InteractionContextBuilder.buildPurchaseContext()`
(`src/orchestration/reward/InteractionContextBuilder.ts:99`) builds `context.purchase`
**directly from the interaction payload**, not from the `purchases` table. So we synthesize
a `purchase` interaction with `{ amount: revenue }` and percentage/tiered rewards work with
**no `purchases` row, no `purchase_claims`, no SDK pixel**.

---

## 5. Why `asset_logs` + settlement are generic enough

- `asset_logs.amount` (`numeric(36,18)`) is **backend-set and arbitrary** — the on-chain
  `RewarderHub` validates only the attestation + bank balance, never the amount
  (`src/domain/rewards/services/SettlementService.ts:374`). "3% + €5 boost" is just a number.
- Status lifecycle (`pending → processing → settled | bank_depleted | cancelled | expired`),
  `availableAt` lockup, and refund-cancellation are all **source-agnostic**
  (`src/domain/rewards/db/schema.ts:67`).
- "Frak-controlled pool" maps to the existing bank model: banks are already **Frak-owned**
  (the `bank-manager` KMS key is the contract owner; merchants only get a manager role).
  For TakeAds, simply **grant no external role** and fund with EURe
  (`src/domain/campaign-bank/repositories/CampaignBankRepository.ts`).

**Constraints to respect (all satisfiable without core changes):**

1. `CreateAssetLogParams` requires `campaignRuleId` + `interactionLogId`
   (`src/domain/rewards/types/index.ts:141`) → we always create a campaign + interaction.
2. Settlement is **on-chain only** and gates on an **active wallet node**
   (`AssetLogRepository.claimPendingForSettlement`) → the affiliate is a wallet user, so OK.
3. `InteractionType` enum is fixed but `purchase` already does everything we need; `custom`
   remains the escape hatch for flat-only rewards.

---

## 6. Data model

### 6a. New table — `takeads_subid_map` (attribution source of truth)

`services/backend/src/domain/<takeads>/db/schema.ts` (new domain module, name TBD):

```ts
export const takeadsSubIdMapTable = pgTable(
    "takeads_subid_map",
    {
        // The opaque value handed to TakeAds as `subId` (uuid/nanoid). Never an internal id.
        subId: varchar("sub_id", { length: 40 }).primaryKey(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        // Cache of the resolved TakeAds deeplink + coupon (re-derivable; not source of truth).
        trackingLink: text("tracking_link"),
        couponCode: varchar("coupon_code"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        // ONE stable subId per (user, brand) → idempotent links, lean table, merge-safe.
        uniqueIndex("takeads_subid_user_merchant_unique").on(
            table.identityGroupId,
            table.merchantId
        ),
        index("takeads_subid_merchant_idx").on(table.merchantId),
    ]
);
```

Optional: a tiny `takeads_sync_state` row (or reuse an existing KV) to persist the Stats API
polling **watermark** (last `updatedAt` processed).

### 6b. Seed data (per brand) — reuses existing tables

- **One Frak EURe `CampaignBank`**, deployed + funded (reuse `CampaignBankRepository.deployBank`
  / `enableDistribution` with the EURe token).
- **`merchants` row per brand**: `name`, `domain` = brand `defaultDomain`, `owner_wallet` =
  Frak admin, `default_reward_token` = **EURe**, `bank_address` = shared Frak bank,
  `explorer_enabled_at` = now, `explorer_config` = `{ logoUrl, description }` from the catalog.
  `product_id` stays **null** (off-chain brand).
- **`campaign_rules` row per brand** (also what makes it visible in the explorer, which
  requires ≥1 active campaign):

```jsonc
{
  "status": "active",
  "rule": {
    "trigger": "purchase",
    "conditions": [],
    "rewards": [
      { "recipient": "referee", "type": "token",
        "amountType": "percentage", "percent": 3, "percentOf": "purchase_amount" },
      { "recipient": "referee", "type": "token",
        "amountType": "fixed", "amount": 5 }            // optional Frak boost
    ],
    "defaultLockupSeconds": 604800,                       // ≥ 1 week (tune per §7)
    "pendingRewardExpirationDays": 60
  },
  "budgetConfig": [ { "label": "lifetime", "durationInSeconds": null, "amount": 10000 } ]
}
```

`budgetConfig` caps Frak's total exposure per brand. The `percent`/`amount` per brand can be
derived from the catalog `commissionRates` plus a configured boost.

---

## 7. Conversion lifecycle (state machine)

| TakeAds `status` | First sighting | Subsequent |
|---|---|---|
| `PENDING` | create `purchase` interaction → `asset_logs` (`pending`, `availableAt = now + Nd`) | ignore amount drift for PoC (first reading authoritative) |
| `CONFIRMED` | same as PENDING (idempotent) | no-op |
| `DECLINED` | n/a | cancel still-`pending` rewards for that interaction → `cancelled`, restore budget |

- **Idempotency** is free: `interaction_logs` unique `(merchant_id, type, external_event_id)`
  with `external_event_id = "takeads:{actionId}"`; `createIdempotent` returns null on dupes.
- **Decline handling** reuses the existing cancel path: resolve the `interaction_logs.id` by
  `external_event_id`, mark it `cancelledAt`, and call
  `AssetLogRepository.cancelPendingByInteractionLogs([id], "refund")` (which also returns the
  `campaignRuleId + amount` for budget restore, mirroring `RewardLifecycleOrchestrator`).

**Tradeoff to document for the product team:** the `availableAt` lockup window **is** the
decline-protection window. Settlement runs once the lockup elapses, even if TakeAds has not
yet confirmed. TakeAds confirms in ~1–3 months, so with a 1-week lockup most rewards settle
**before** confirmation, and any decline arriving post-settlement is an **unrecoverable
write-off** (accepted acquisition cost). Lengthening the lockup trades reward UX latency for
lower decline exposure — a tunable per-brand business knob, not a code change.

---

## 8. Link generation (lazy, behind a button)

Endpoint (auth required; user must have a wallet-backed `identityGroupId` to be payable):

```
POST /user/.../takeads/:merchantId/link
  1. resolve identityGroupId from session
  2. SELECT subId WHERE (identityGroupId, merchantId)            // reuse
       hit + cached link → return immediately (no TakeAds call)
       miss → mint subId, INSERT ... ON CONFLICT DO NOTHING      // race-safe via unique idx
              call PUT /v2/resolve { iris:[brandUrl], subId }, cache trackingLink+coupon, return
```

- Generation is **lazy + per-brand**, never eager for the whole explorer list (`/v2/resolve`
  is an external call with undocumented limits/latency; eager = N calls per list load).
- Backend **owns** subId minting — the frontend can't be trusted to bind a subId to a user.
- Both end-user flows ("coupon to share" and "personal tracking link") collapse to the same
  primitive: a `subId`-tagged deeplink; the coupon flow additionally surfaces the public code.
- Matches the existing explorer `buttonShare` placement pattern
  (`src/domain/merchant/schemas/index.ts`, `clickAction: share-modal | sharing-page`).

---

## 9. Ingestion (Stats API polling)

Cron (e.g. hourly): `GET /v3/api/stats/action?updatedAtFrom={watermark}&limit=500` (paginate).
For each action:

1. Resolve `subId → { identityGroupId, merchantId }` via `takeads_subid_map`; skip+log unknown.
2. `PENDING`/`CONFIRMED`: build `PurchasePayload` (`{ orderId: actionId, amount: revenue,
   currency: currencyCode, items: [], purchaseId: "takeads:{actionId}" }`) and
   `InteractionLogRepository.createIdempotent({ type:"purchase", identityGroupId, merchantId,
   externalEventId:"takeads:{actionId}", payload })`; on insert emit `newInteraction`.
3. `DECLINED`: run the §7 cancel path.
4. Advance the watermark to the max `updatedAt` processed.

From there **everything is existing code**: `BatchRewardOrchestrator` prices the reward,
`asset_logs` rows are created (`pending`, locked), `SettlementOrchestrator` pays EURe from
the Frak bank once `availableAt` passes, and it shows in reward history.

---

## 10. PoC implementation steps

1. **Schema** (`takeads_subid_map` + optional `takeads_sync_state`) — Drizzle defs only;
   flag the migration for the db team.
2. **TakeAds API client** (`infrastructure/integrations`, `ky`-based, mirroring Airtable/
   Resend style): `listMerchants`, `resolveLink`, `getActions`. Secret: `TAKEADS_API_KEY`.
3. **Seed/sync**: deploy + fund the Frak EURe bank; upsert synthetic `merchants` +
   `campaign_rules` from the catalog for the hand-picked brand IDs (manual list for v1).
4. **Link service + endpoint** (§8): subId mint/lookup + `/v2/resolve` + cache.
5. **Ingestion cron + orchestrator** (§9 + §7): poll, map subId→identity, upsert interactions,
   handle declines, advance watermark.
6. **Tests**: subId idempotency/race; ingestion idempotency; PENDING→reward; DECLINED→cancel
   + budget restore; percentage pricing of `revenue` in EUR→EURe.

---

## 11. Open decisions / risks

- **Lockup length per brand** (UX latency vs decline exposure) — §7.
- **Treasury/float**: EURe fronted now, EUR collected from TakeAds later (≥€20). Net boost
  economics per brand.
- **Amount drift before confirmation** (partial refunds): PoC ignores; revisit if material.
- **Polling vs postback**: start polling; add postback for latency once stable.
- **Sandbox + rate limits**: confirm with TakeAds before load.
- **Catalog refresh cadence** and brand de-listing (campaign `paused`/`archived`).

---

## 12. Appendix — key references

**Backend touchpoints (existing, reused):**
- `src/domain/rewards/db/schema.ts` — `asset_logs`, `interaction_logs`.
- `src/orchestration/reward/InteractionContextBuilder.ts:99` — `context.purchase` from payload.
- `src/orchestration/BatchRewardOrchestrator.ts` — interaction → `asset_logs`.
- `src/domain/campaign/services/RuleEngineService.ts` + `RewardCalculator.ts` — pricing.
- `src/orchestration/SettlementOrchestrator.ts` + `src/domain/rewards/services/SettlementService.ts` — on-chain payout.
- `src/domain/campaign-bank/repositories/CampaignBankRepository.ts` — bank deploy/fund.
- `src/orchestration/ExplorerOrchestrator.ts` — explorer listing (needs `explorer_enabled_at` + ≥1 active campaign).
- `src/orchestration/RewardLifecycleOrchestrator.ts` + `AssetLogRepository.cancelPendingByInteractionLogs` — decline/cancel + budget restore.

**TakeAds endpoints:**
- Catalog: `GET /v1/product/monetize-api/v2/merchant`
- Link: `PUT /v2/resolve` (`iris[]`, `subId`)
- Coupons: `/v1/product/monetize-api/v1/coupon*`
- Stats: `GET /v3/api/stats/action` (`subId`, `revenue`, `commission`, `status`, `currencyCode`)
- Auth: `Authorization: Bearer <key>`; docs at developers.mitgo.com / docs.takeads.com
