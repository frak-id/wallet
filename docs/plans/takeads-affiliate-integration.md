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
- **Synthetic-brand onboarding rides the new platform-admin capability** — rather than a
  one-off seed script, a Frak **platform admin** registers each synthetic brand through the
  existing SIWE registration flow with two opt-in flags: (a) `skipDomainValidation` to
  **skip the DNS-TXT check** (SIWE signature still required), and (b) `useFrakBank` to
  **attach the one hardcoded shared Frak EURe `CampaignBank`** instead of deploying a fresh
  per-merchant bank. Any admin registration also co-admins the rest of the Frak team. See §10.

---

## 2. Is it possible with TakeAds? (capability summary)

| Need | Endpoint / mechanism | Notes |
|---|---|---|
| Brand catalog + commission rates | `GET /v1/product/monetize-api/v2/merchant` | `name`, `domains`, logo, `commissionRates[{fixedCommission, percentageCommission}]`. **No** server-side brand filter — pull all, filter client-side. |
| Per-user tracking link / deeplink | `PUT /v1/product/monetize-api/v2/resolve` (`iris[]`, `subId`) | Or append `&s=<subId>&url=<deeplink>` to the catalog's `trackingLink`. **Single** `subId` slot (≤6144 chars; `[1-9A-Za-z_-]`). |
| Coupons | coupon endpoints (per-coupon `trackingLink`) | Codes are **shared/public**, not unique-per-user. Attribution rides the `subId` on the click-through link. |
| Conversion feedback | `GET /v3/api/stats/action` (pull) + Postback (push, ≤10 URLs) | Both expose `subId`, `orderAmount`, `publisherRevenue`, `status`, `currencyCode`. |

**Stats API exposes amounts even while `PENDING`** — see §6. Both `orderAmount` (the buyer's
purchase amount) and `publisherRevenue` (our publisher payout) are present from first
sighting, alongside `currencyCode`, `subId`, and `status`. Amounts may adjust (e.g. partial
refund) before confirmation.

> **§2a — Verified API contract (confirmed against developers.mitgo.com / docs.takeads.com,
> and modelled verbatim in `infrastructure/integrations/takeads/config.ts`).** The plan
> historically used the conceptual names `revenue`/`commission`/`DECLINED`; the real wire
> shapes are:
> - **Base URL** `https://api.takeads.com`; auth `Authorization: Bearer <key>` (platform key
>   for resolve, account key for stats — same header, possibly two secrets later).
> - **Catalog** `GET /v1/product/monetize-api/v2/merchant` → `{ meta:{ next:int|null }, data:[…] }`;
>   merchant logo is `imageUri`; pagination `next` is an **integer**, `limit` ≤ 500.
> - **Resolve** `PUT /v1/product/monetize-api/v2/resolve`, body `{ iris[], subId?, withImages? }`
>   → `{ data:[{ iri, trackingLink, imageUrl }] }` (empty `data` when no offer matched).
> - **Stats** `GET /v3/api/stats/action` → `{ meta:{ limit, next:string|null }, data:[…] }`;
>   `next` is an **opaque string** cursor, `limit` ≤ 500. Per action: `actionId` (string uuid,
>   our idempotency key), `merchantId` (int), `subId`, `orderAmount` (buyer total = "revenue"),
>   `publisherRevenue` (our payout = "commission"), `currencyCode`, `status`, `updatedAt`.
> - **Status enum is `PENDING | CONFIRMED | CANCELED | SETTLED`** — there is **no `DECLINED`**
>   (the decline terminal is **`CANCELED`**), and `CONFIRMED` auto-rolls to `SETTLED` after
>   ~45–50 days with no further change. Read every `DECLINED` below as `CANCELED`.

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

`services/backend/src/domain/takeads/db/schema.ts` (**implemented** — see §11 step 1):

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
polling **watermark** (last `updatedAt` processed). **Implemented** as `takeads_sync_state`
(keyed `key` PK + nullable `watermark` timestamp).

### 6a-bis. New table — `takeads_merchant` (brand linkage) — **implemented**

Links one internal `merchants` row (a synthetic brand) to its TakeAds catalog brand, captured
by a platform admin **at registration** (§10b). This is the int↔uuid bridge that conversion
ingestion (Stats actions carry an integer `merchantId`) and catalog re-sync resolve through.

```ts
export const takeadsMerchantTable = pgTable(
    "takeads_merchant",
    {
        merchantId: uuid("merchant_id").primaryKey(),        // internal merchant
        takeadsMerchantId: integer("takeads_merchant_id").notNull(), // catalog brand id
        trackingLink: text("tracking_link").notNull(),       // base affiliate link
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("takeads_merchant_takeads_id_unique").on(table.takeadsMerchantId),
    ]
);
```

**Decision (link-gen):** per-user share links are built by setting the `s` (subId) query
param on the stored `trackingLink` — **no `/resolve` call** is needed for brand-level sharing
(`/resolve` + `iris` is only required to affiliate arbitrary deep/product URLs). The platform
admin captures `takeadsMerchantId` + `trackingLink` from the catalog at registration; the
registration route (`api/business/merchant/registration.ts`) writes this row via
`TakeadsContext.repositories.takeadsMerchant.link(...)` **only when the SIWE signer is a
platform admin** (gated on the new `isPlatformAdmin` returned by
`MerchantRegistrationService.register`). Frontend exposes two admin-only fields in the
registration wizard (`apps/business` MerchantWizard).

### 6b. Seed data (per brand) — reuses existing tables

Created via the **platform-admin registration options** (§10), not a raw SQL seed:

- **One Frak EURe `CampaignBank`**, deployed + funded **once** (reuse
  `CampaignBankRepository.deployBank` / `enableDistribution` with the EURe token), then its
  address **hardcoded/env-configured** so every synthetic merchant attaches to it.
- **`merchants` row per brand**: `name`, `domain` = brand `defaultDomain`, `owner_wallet` =
  the registering platform-admin's SIWE wallet, `default_reward_token` = **EURe**,
  `bank_address` = shared Frak bank (via `useFrakBank`, **not** freshly deployed),
  `explorer_enabled_at` = now, `explorer_config` = `{ logoUrl, description }` from the catalog.
  `verified_at` and `product_id` are set as in the normal flow; **DNS-TXT verification is
  skipped** (via `skipDomainValidation`) while the **SIWE signature is still required**.
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
| `CANCELED` | n/a | cancel still-`pending` rewards for that interaction → `cancelled`, restore budget |

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
2. `PENDING`/`CONFIRMED`: build `PurchasePayload` (`{ orderId: actionId, amount: orderAmount,
   currency: currencyCode, items: [], purchaseId: "takeads:{actionId}" }`) and
   `InteractionLogRepository.createIdempotent({ type:"purchase", identityGroupId, merchantId,
   externalEventId:"takeads:{actionId}", payload })`; on insert emit `newInteraction`.
3. `CANCELED`: run the §7 cancel path.
4. Advance the watermark to the max `updatedAt` processed.

From there **everything is existing code**: `BatchRewardOrchestrator` prices the reward,
`asset_logs` rows are created (`pending`, locked), `SettlementOrchestrator` pays EURe from
the Frak bank once `availableAt` passes, and it shows in reward history.

---

## 10. Platform-admin setup path (leverage the new capability)

A **platform-admin** role was recently added to the business app + backend specifically to
ease this integration. Today it is a **read-only foundation**; for TakeAds we extend it with
two narrow **write** capabilities (register-without-verification + shared-bank attach).

### 10a. What platform admin already unlocks (read-only)

- **Allow-list service** `PlatformAdminService.isPlatformAdmin(wallet)` backed by the
  `PLATFORM_ADMIN_WALLETS` env secret (comma-separated, lowercased, memoized)
  (`src/domain/auth/services/PlatformAdminService.ts`; wired in `auth/context.ts`).
- **Read bypass** in `hasMerchantAccess` for **GET/HEAD only** on any merchant
  (`src/api/business/middleware/session.ts`). Writes (`POST/PUT/DELETE`) still 403.
- **`GET /merchant/my`** returns `isPlatformAdmin: true` + `allMerchants` (full DB list);
  **`GET /merchant/:id`** derives `role: "platform_admin"`
  (`src/api/business/merchant/index.ts`).
- **Business UI**: read-only banners/badges, deep-link to any merchant, funding/members/edit
  surfaces hidden for the read-only view (`apps/business` — `useReadOnlyMerchant`,
  `useMyMerchants`, `$merchantId.tsx`, `MerchantDetails`, etc.).

> Net: platform admin gives us **identity + cross-merchant visibility**, but **no write
> path**. Synthetic-brand onboarding needs two small write affordances, added below.

### 10b. Implemented — admin options on the existing registration flow

`POST /merchant/register` (`src/api/business/merchant/registration.ts`) keeps its **single
SIWE-verified flow** for everyone. Rather than duplicating logic, two **opt-in body flags**
were added and are **only honored when the SIWE signer is a platform admin** (membership
tested in-service against the configured admin wallets):

- `skipDomainValidation` — bypasses the `DnsCheckRepository.isValidDomain` TXT check (a
  synthetic brand has no domain Frak controls). SIWE signature + statement are still required.
- `useFrakBank` — links the brand to the shared Frak bank (see 10c) and makes the route
  **skip** the per-merchant `deployAndSetupBank` (returned via `{ frakBankLinked }`).

The route passes `AuthContext.services.platformAdmin.getAdminWallets()` into
`MerchantRegistrationService.register`; the service computes `isPlatformAdmin` from the
recovered SIWE wallet, gates both flags on it, and — for any platform-admin registration —
**co-admins every other platform-admin wallet onto the new merchant**
(`MerchantAdminRepository.add`, idempotent) so the whole Frak team can manage it. Non-admins
passing the flags are ignored (still DNS-verified, no shared bank). `owner_wallet`,
`verified_at`, and `product_id` behave exactly as the normal flow (no special-casing).

### 10c. Gap to close — hardcoded shared Frak bank

There is **no shared-bank concept today**: `deployAndSetupBank` deploys a CREATE2 bank per
merchant and is the only writer of `merchants.bank_address`
(`src/domain/campaign-bank/services/CampaignBankService.ts`). For TakeAds we want every
synthetic merchant to point at **one** pre-funded Frak EURe bank.

- Introduce a configured constant/secret, e.g. `FRAK_SHARED_CAMPAIGN_BANK` (env), holding the
  one-time-deployed shared EURe bank address. **Implemented today as a `zeroAddress`
  placeholder** in `MerchantRegistrationService` (exported `FRAK_SHARED_CAMPAIGN_BANK`);
  `register()` writes it to `merchants.bank_address` when an admin passes `useFrakBank` and
  the route skips per-merchant bank deploy (`frakBankLinked`).
  > **Residual risk (must-track before real settlement):** `zeroAddress` is a *truthy*
  > string, so `CampaignBankService.deployAndSetupBank` treats frak-bank merchants as
  > “already deployed” (the desired no-op for registration), but `syncBankRoles` /
  > `transferBankRoles` / `getBankStatus` would issue on-chain calls against `address(0)`.
  > Before these brands settle real on-chain rewards: (a) replace the placeholder with the
  > deployed+funded bank, and (b) add `bankAddress && bankAddress !== zeroAddress` guards in
  > those `CampaignBankService` methods.
- When the admin registration opts into the shared bank, the backend **does not call
  `deployAndSetupBank`**. Instead it: (1) **double-checks on-chain** that the address is a
  real `CampaignBank` that is **open** (`isOpen`), owned by the `bank-manager` KMS key, and
  has EURe allowance set for the `RewarderHub` (extend `CampaignBankRepository` with a
  read-only `assertSharedBank(address)` using existing ABI calls); (2) writes
  `merchants.bank_address` = the shared address via `updateBankAddress`.
- **No external manager role is granted** for synthetic merchants (per §5) — the bank stays
  fully Frak-controlled. `merchants.bank_address` is intentionally non-unique, so sharing one
  bank across many synthetic merchants needs no schema change.

### 10d. Frontend (optional for v1)

The backend admin path is enough to script onboarding. A thin admin-only UI affordance
(“Register synthetic brand → skip verification + use Frak bank”) can be layered on the
existing platform-admin surfaces later; v1 can drive `POST /merchant/register/admin` directly.

---

## 11. PoC implementation steps

1. **[DONE] Schema** (`takeads_subid_map` + `takeads_sync_state`) — Drizzle defs only, in
   `src/domain/takeads/db/schema.ts`, registered in `infrastructure/persistence/postgres.ts`.
   **Migration is db-team owned** (per `services/backend/AGENTS.md`) — tables stay inert
   until the db team generates + runs it. `takeads_sync_state` is a keyed watermark row
   (`key` PK + `watermark` timestamp) for the §9 poll cursor.
2. **[DONE] TakeAds API client** (`infrastructure/integrations/takeads/`, `ky`-based,
   mirroring OpenPanel/Airtable): `listMerchants`, `resolveLinks`, `getActions`; types in
   `config.ts` modelled verbatim from the docs (§2a). Secret `TAKEADS_API_KEY` wired in
   `infra/config.ts` + `infra/gcp/secrets.ts`. Lazy `getTakeAdsClient()` accessor (throws if
   the key is unset, so envs without it stay inert until the integration is exercised).
3. **Platform-admin write extension** (§10): admin-guarded register-without-verification
   branch + shared-bank attach (`FRAK_SHARED_CAMPAIGN_BANK` + `assertSharedBank`).
   **[DONE in §10b]** register flags + co-admin propagation; **gap** = `assertSharedBank`
   on-chain check + real funded shared bank (placeholder `zeroAddress` today, see §10c).
4. **Seed/sync**: deploy + fund the Frak EURe bank **once** (then hardcode its address);
   onboard synthetic `merchants` via the §10 admin path + upsert `campaign_rules` from the
   catalog for the hand-picked brand IDs (manual list for v1).
5. **Link service + endpoint** (§8): subId mint/lookup + `/v2/resolve` + cache.
6. **Ingestion cron + orchestrator** (§9 + §7): poll, map subId→identity, upsert interactions,
   handle declines, advance watermark.
7. **Tests**: admin register-without-verification + shared-bank attach (admin-gated, public
   route unchanged); subId idempotency/race; ingestion idempotency; PENDING→reward;
   DECLINED→cancel + budget restore; percentage pricing of `revenue` in EUR→EURe.

---

## 12. Open decisions / risks

- **Lockup length per brand** (UX latency vs decline exposure) — §7.
- **Treasury/float**: EURe fronted now, EUR collected from TakeAds later (≥€20). Net boost
  economics per brand.
- **Amount drift before confirmation** (partial refunds): PoC ignores; revisit if material.
- **Polling vs postback**: start polling; add postback for latency once stable.
- **Sandbox + rate limits**: confirm with TakeAds before load.
- **Catalog refresh cadence** and brand de-listing (campaign `paused`/`archived`).
- **Admin write surface**: register-without-verification + shared-bank attach must stay
  strictly `isPlatformAdmin`-gated; the public `POST /merchant/register` flow (SIWE + DNS)
  must remain unchanged. Guard against an admin attaching a non-Frak bank (the on-chain
  `assertSharedBank` check is the safeguard).

---

## 13. Appendix — key references

**Backend touchpoints (existing, reused):**
- `src/domain/rewards/db/schema.ts` — `asset_logs`, `interaction_logs`.
- `src/orchestration/reward/InteractionContextBuilder.ts:99` — `context.purchase` from payload.
- `src/orchestration/BatchRewardOrchestrator.ts` — interaction → `asset_logs`.
- `src/domain/campaign/services/RuleEngineService.ts` + `RewardCalculator.ts` — pricing.
- `src/orchestration/SettlementOrchestrator.ts` + `src/domain/rewards/services/SettlementService.ts` — on-chain payout.
- `src/domain/campaign-bank/repositories/CampaignBankRepository.ts` — bank deploy/fund.
- `src/orchestration/ExplorerOrchestrator.ts` — explorer listing (needs `explorer_enabled_at` + ≥1 active campaign).
- `src/orchestration/RewardLifecycleOrchestrator.ts` + `AssetLogRepository.cancelPendingByInteractionLogs` — decline/cancel + budget restore.

**Platform-admin touchpoints (new capability, extended for §10):**
- `src/domain/auth/services/PlatformAdminService.ts` (+ `auth/context.ts`) — `isPlatformAdmin` allow-list (`PLATFORM_ADMIN_WALLETS`).
- `src/api/business/middleware/session.ts` — `hasMerchantAccess` read-only bypass (GET/HEAD); pattern to reuse for the admin register gate.
- `src/api/business/merchant/registration.ts` + `src/domain/merchant/services/MerchantRegistrationService.ts` — public register flow to branch/factor for the admin path.
- `src/domain/campaign-bank/services/CampaignBankService.ts` + `repositories/CampaignBankRepository.ts` — `deployAndSetupBank` (skip for shared bank) + add `assertSharedBank`.
- `src/domain/merchant/repositories/MerchantRepository.ts` — `updateBankAddress` (attach shared bank), `create`.
- `infra/config.ts` + `infra/gcp/secrets.ts` — secret wiring (`PLATFORM_ADMIN_WALLETS`; add `FRAK_SHARED_CAMPAIGN_BANK`).
- `apps/business` — `useReadOnlyMerchant`, `useMyMerchants`, `$merchantId.tsx` (read-only UI; optional admin register affordance).

**TakeAds endpoints:**
- Catalog: `GET /v1/product/monetize-api/v2/merchant`
- Link: `PUT /v1/product/monetize-api/v2/resolve` (`iris[]`, `subId`) → `data[{ iri, trackingLink, imageUrl }]`
- Coupons: `/v1/product/monetize-api/v1/coupon*`
- Stats: `GET /v3/api/stats/action` (`subId`, `orderAmount`, `publisherRevenue`, `status`, `currencyCode`, `actionId`, `updatedAt`)
- Auth: `Authorization: Bearer <key>`; docs at developers.mitgo.com / docs.takeads.com
- **Implemented client + types:** `services/backend/src/infrastructure/integrations/takeads/`
  (`config.ts` shapes, `TakeAdsClient.ts` → `listMerchants` / `resolveLinks` / `getActions`;
  secret `TAKEADS_API_KEY`). See §2a for the verified contract.
