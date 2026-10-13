# Product display for product-scoped campaigns

Status: **planned, not implemented** (re-checked against `dev` 2026-10-13: `productDisplay` and
`describeProductScope` exist nowhere in source). Every piece is additive and can land on its own;
see "Sequencing". Scope background: `services/backend/docs/product-scoped-campaigns.md`. Open
findings this work would close: PSC-4, 10, 11, 21, 24, 26 in
`docs/audits/2026-08-15-product-scoped-campaigns.md`.

## Problem

A campaign can be scoped to products (`rule.productScope`), and business authors that scope in the
wizard's Products step (`Creation/ProductsCampaign/`). But every shopper-facing surface renders the
scope as one static string: `explorer.detail.productScopeNote` ("On selected products only",
`CampaignInfoSection.tsx`) and `sdk.sharingPage.card.tagline2_product`. Which products? At what
reward? The predicate (`{sku in ["A-S","A-M"]}`) carries no name, image or link.

Motivating case: "buy X → 50 €, buy Y → 25 €". That is two campaigns (one `productScope` each, no
per-product reward), and today both render as the same vague sentence.

## Decisions

### Storage: `metadata.productDisplay`, not `rule`

`rule` is locked after publish (`RULE_LOCKED`, `CampaignManagementService.update`). A typo, a dead
product link or a broken image must be fixable on a live campaign without archive and republish,
which resets budget accounting. So the descriptor is economically inert and separately editable.
`rule.productScope` is `RuleCondition[] | ConditionGroup`, so there is nowhere to hang it there
anyway. Precedent: the campaign `name` is already editable on live campaigns.

### Shape

```ts
type ProductDisplayItem = {
    /** Present: renders inside the scope clause holding that value. Absent: campaign-level block. */
    match?: { productId?: string; sku?: string };
    name: string;      // maxLength 120
    url?: string;      // https:// only, maxLength 2048
    imageUrl?: string; // https:// only, maxLength 2048
};
```

`maxItems: 20`: real scopes are `{sku in [...]}` over many SKUs. Keyed entries answer "which
product is this SKU?"; unkeyed ones answer "what is this campaign about?". A non-enumerable scope
(`between`, `starts_with`) has no values to key on, so it uses unkeyed entries only. Unkeyed entries
always render at campaign level, even with a single clause.

### It is display-only, and it can lie

Nothing ties `match` to the predicate: a merchant can name "Blue Widget" on `sku = WIDGET-RED`, at
the same trust level as the campaign `name`. Because it describes money, the failure modes are
deliberate:

- **Stale keyed entry** (its value left the scope) → rendered **nowhere**, never at campaign level,
  which would advertise a product the campaign no longer covers. Business warns on save.
- **Keyed entry in two clauses** (same SKU in an include and an exclude) → renders in both.
- **Keyed and unkeyed together** → both render, campaign block first.

## Backend

1. **Schema.** Add `ProductDisplayItemSchema` and `productDisplay: t.Optional(t.Array(…, { maxItems:
   20 }))` to `CampaignMetadataSchema` (`domain/campaign/schemas/index.ts`); it propagates to the
   create, update and response schemas. Add the same field to `EstimatedRewardItemSchema`. URLs use
   the existing `HttpsUrlSchema` pattern from `domain/merchant/schemas/index.ts`, never
   `format: "uri"`, which accepts `javascript:` and `data:`.
2. **Post-publish carve-out.** `CampaignManagementService.update` only applies `metadata` when
   `isDraft`. Add a non-draft branch that merges **only** `productDisplay` onto the stored metadata,
   and reject a request carrying any other metadata key (as `rule` throws `RULE_LOCKED`). Clearing
   is an explicit `[]`; an omitted key means unchanged. Concurrent edits are last-write-wins on the
   array (the `fromStatuses` guard checks status only); bounded and cosmetic, so document it.
   While there, add `"metadata"` to the `Pick<>` in `CampaignRuleRepository.update` and drop the
   `as Parameters<…>[1]` cast it forces in `CampaignManagementService` (PSC-21).
3. **Public contract.** `EstimatedRewardService.buildCampaignRewardItem` passes
   `campaign.metadata?.productDisplay` through, and nothing else from `metadata`. Add the field to
   `MerchantReward` (`sdk/core/src/types/rpc/merchantInformation.ts`); `merchantRewardParity.ts`
   fails the build if the two sides drift. Cache staleness after an edit is up to the
   `activeRulesCache` TTL, fine for cosmetic data.

## SDK: `describeProductScope`

New in `sdk/core/src/rewards/`, next to `matchesProductScope`. Display-only and fail-open; the
backend evaluator stays the only authority on eligibility. It returns structure, not a string, so
each app applies its own i18n:

```ts
type ScopeDescription = {
    products: ProductDisplayItem[]; // unkeyed entries
    logic: "all" | "any" | "none";
    clauses: {
        polarity: "include" | "exclude";
        operator: ConditionOperator;
        field: string;
        products: ProductDisplayItem[];             // keyed entries that hit this clause
        rawValues: (string | number | boolean)[];   // values with no entry, rendered raw
    }[];
};
```

Polarity comes from `NEGATIVE_OPERATORS` (`sdk/core/src/rewards/operators.ts`) combined with
`logic: "none"`, the classification the backend evaluator already uses. Business has a second
humanizer today (`humanizeField`, `ConditionChip`, `ConditionGroupDisplay` in
`CampaignDetailsSheet/ConfigTab.tsx`); it can move onto this one.

## Wallet: explorer detail

Replace the `productScopeNote` row in `CampaignInfoSection.tsx` with a block per clause ("Only if
the order contains" / "…does not contain"), then product rows: thumbnail via `mediaSrcSet`, name,
optional link. Add to `CampaignView` only; `ExplorerCard` shares `useCampaignView` and has no room
for it. Fallbacks, all required: a clause with no products shows raw values; no `productDisplay`
keeps today's `productScopeNote`; a non-enumerable scope shows generic polarity copy plus the
campaign block. Check every URL with `isHttpUrl` (`sdk/core/src/utils/product/sanitizeProducts.ts`)
at render, as a second layer behind the schema. `CampaignInfoSection` has no test file today.

Copy under `explorer.detail.productScope.*`, en + fr.

## Business: authoring

- **In the Products step.** Rows of name (required), product URL, image; cap 20. For an enumerable
  scope (`eq`, `in`, `not_in` on `productId`/`sku`), render one row per scope value with `match`
  filled in and shown read-only. For an advanced scope (what `isAdvancedScope` already detects),
  free-form rows without `match`. A scope can need both. The merchant never types a SKU into a
  matcher.
- **Warn on stale entries** at save: "2 products no longer match this campaign's scope and won't be
  shown." Add an inline hint that the rows are what shoppers see, not a rule.
- **After publish**, a published campaign shows a read-only rule summary plus an editable product
  section that sends `metadata: { productDisplay: [...] }` and nothing else. Never round-trip the
  cached metadata. Disable save while a request is in flight.
- **Images** go through `POST /business/:merchantId/media/upload` with `type: "icon"`, so they land
  on `cdn.gcp.frak.id` and get `mediaSrcSet` variants; a free-text URL still validates but loads
  full size on mobile.
- **URL check** in the form mirrors the backend: check the scheme explicitly, not `type="url"`.

## Tests

Schema (including `javascript:` and `data:` rejection); the carve-out matrix (draft vs published,
clearing with `[]`, a foreign metadata key rejected); `EstimatedRewardService` passthrough;
`describeProductScope` (nested groups, negation, keyed/unkeyed split, a stale entry renders nowhere);
`CampaignInfoSection`; business: publish-then-edit sends only `productDisplay`, the 20-row cap,
enumerable scopes fill `match`, the stale warning fires. Changeset: `@frak-labs/core-sdk` minor.

## Out of scope

- **Sharing page.** Later, in the "How is my reward calculated?" answer, as a sibling of
  `RewardBreakdown` rather than inside it, since that component returns `null` in some reward states.
  `selectFormattedReward` already takes `products`, and `DisplayCampaign.matchedProducts` exists but
  no UI reads it yet.
- **Several campaigns at once.** `selectDisplayCampaign` / `selectBestReward` pick one campaign, so
  the explorer shows the 50 € one and hides the 25 € one. `productDisplay` is the prerequisite for
  listing both meaningfully. When that lands: all live campaigns ranked by `campaignRank`, no dedupe
  (rewards are additive), headline "up to X" (`explorer.detail.step2Title` needs an `_upTo`
  variant). Keep `productDisplay` an array iterated at render; never add a singular product field
  to `BestReward` or `CampaignView`.
- **Campaign list cell.** A product thumbnail and name in `TableCampaigns` would need `metadata` on
  the list response first.

## Sequencing

Nothing is breaking. The backend is an optional field on an existing nullable `jsonb` column: no
migration, no backfill. The wallet needs the fallback anyway, so "not shipped" and "campaign has no
`productDisplay`" are the same path. The only ordering constraint: the backend before the business
authoring UI, which cannot send a field the API rejects. The SDK helper is pure logic and testable
alone; the explorer block depends on it.
