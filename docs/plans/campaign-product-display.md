# Product display for product-scoped campaigns

Status: **planned, not implemented**. Shippable independently at any time —
see "Sequencing / shippability".

## Problem

A campaign can be scoped to products (`rule.productScope`, see
`services/backend/docs/product-scoped-campaigns.md`). Today every surface
renders that fact as one static string:

- `explorer.detail.productScopeNote` → *"On selected products only"*
  (`CampaignInfoSection.tsx:141-147`)
- `sdk.sharingPage.card.tagline2_product` → *"on selected products!"*

A user cannot act on that. Which products? At what reward? The scope predicate
itself (`{sku in ["A-S","A-M"]}`) is machine-readable but not human-readable,
and carries no name, image or link.

Motivating merchant case: *"buy product X → 50 €, buy product Y → 25 €"*. That
is two campaigns (a campaign has one `productScope` and no per-product reward
variance), and today both would render as the same vague sentence.

## Decisions

### Storage: `metadata.productDisplay`, not `rule`

`rule` is immutable after publish (`RULE_LOCKED`,
`CampaignManagementService.update`). A cosmetic typo, a dead PDP link or a
broken image must be fixable on a live campaign without archive/republish
(which resets budget accounting). So the descriptor must be economically inert
and separately editable.

Also structurally forced: `rule.productScope` is
`RuleConditions = RuleCondition[] | ConditionGroup` — you cannot hang a
sub-object on the array branch.

Precedent: campaign `name` is **already** freely editable on live campaigns
(`CampaignManagementService.ts:318`, outside the `isDraft` guard). Merchant
display prose on a published campaign is an existing, accepted mutability.

### Shape

```ts
type ProductDisplayItem = {
    /**
     * Optional. Identifies which productScope leaf this describes, matched
     * against the condition's `value` on the same field.
     *  - present ("keyed")   → resolves into the clause containing that value
     *  - absent  ("unkeyed") → describes the campaign as a whole
     */
    match?: { productId?: string; sku?: string };
    name: string;      // maxLength 120
    url?: string;      // https:// only, maxLength 2048
    imageUrl?: string; // https:// only, maxLength 2048
};
```

`maxItems: 20`. Realistic scopes are `{sku in [...]}` over many SKUs; a low cap
would leave most of a scope undescribed.

**Keyed vs unkeyed answer different questions**, which is why there is no
"pick one" ambiguity:

| | Question | Renders |
|---|---|---|
| Keyed | *which product is this SKU?* | inside its clause |
| Unkeyed | *what is this campaign about?* | campaign-level block |

A non-enumerable scope (`between`, `starts_with`) has no values to key on, so
it uses unkeyed entries and the clause renders as generic polarity copy. This
is the case that motivated making `match` optional.

Rejected: attributing unkeyed entries to the clause when there is exactly one
clause. With a single clause, campaign-level and clause-level render
identically (the block sits directly above it), so the special case buys
nothing and adds a branch. Always campaign-level.

### It is display-only, and it can lie

Nothing links `match` to the scope predicate's truth. A merchant can name
"Blue Widget" on a campaign scoped to `sku = WIDGET-RED`. Same trust level as
the campaign `name` today — accepted, not validated. But it is a display that
can lie about money, so the failure modes below are deliberate:

- **Stale keyed entry** (SKU dropped from scope, entry left behind) → matches
  no clause → **rendered nowhere**. It must *not* fall back to campaign level;
  that would advertise a product the campaign no longer covers. The business
  app should warn on save, since the merchant otherwise gets no feedback.
- **Keyed entry matching two clauses** (same SKU in an include and an exclude)
  → renders in both. It genuinely is in both.
- **Mixed keyed + unkeyed** → both render, campaign block first, no dedupe.

## Steps

### 1. Backend schema

`services/backend/src/domain/campaign/schemas/index.ts`

Add `ProductDisplayItemSchema` and
`productDisplay: t.Optional(t.Array(..., { maxItems: 20 }))` to
`CampaignMetadataSchema`. That auto-propagates to `CampaignCreateBodySchema`,
`CampaignUpdateBodySchema` and `CampaignResponseSchema`, which all reuse it.

Add the same field to `EstimatedRewardItemSchema`. It does **not** go in the
`Omit<>` list — that exists only for the recursive `RuleConditions` types.

**URL validation must be `t.String({ pattern: "^https://", maxLength: 2048 })`,
not `format: "uri"`.** Verified empirically by compiling the real schema:

```
true  javascript:alert(document.cookie)
true  data:text/html;base64,PHNjcmlwdD4=
true  vbscript:msgbox(1)
false not a url
```

`format` validation *is* registered and enforced here, which makes it worse —
it gives false confidence. The existing `ExplorerConfigSchema` fields
(`heroImageUrl`, `logoUrl`) use this insufficient pattern today, and
`merchantMetadata.homepageLink` (`domain/merchant/schemas/index.ts:209`) is a
bare `t.String()` with no format at all, rendered straight into an `href` at
`SsoSubtitle.tsx:22`. **That is a pre-existing live XSS sink, independent of
this feature** — worth fixing separately.

### 2. Post-publish carve-out

`CampaignManagementService.update`. Today `allowedUpdates.metadata` sits inside
`if (isDraft)`. Add a non-draft branch merging **only** `productDisplay`:

```ts
if (!isDraft && input.metadata?.productDisplay !== undefined) {
    // Reject rather than silently drop: `rule` throws RULE_LOCKED, so a client
    // resending a full cached metadata object should learn about it too.
    assertOnlyProductDisplay(input.metadata);
    allowedUpdates.metadata = {
        ...campaign.metadata,
        productDisplay: input.metadata.productDisplay,
    };
}
```

`goal` / `specialCategories` / `territories` stay draft-locked.

Two documented trade-offs:

- **Lost update.** Read-modify-write on a jsonb column. The repository's
  `fromStatuses` guard re-checks *status* only, not concurrent metadata writes
  (`CampaignRuleRepository.ts:216-241`), so two concurrent edits are
  last-write-wins. Bounded (only `productDisplay` is mutable post-publish) and
  cosmetic. Add a one-line comment, matching how this repo documents the cache
  race.
- **Clearing** = explicit `productDisplay: []`. Omitting the key means
  "unchanged" (`cleanUpdates` filters `undefined`).

**Cheap fix while in here:** add `"metadata"` to the `Pick<>` at
`CampaignRuleRepository.ts:217-224`. It is absent today, yet
`CampaignManagementService.ts:343` already forces metadata writes through with
`as Parameters<...>[1]`, suppressing a real type error. This step adds a second
call site depending on that lie.

### 3. Wire to the public contract

`EstimatedRewardService.buildCampaignRewardItem` — add
`productDisplay: campaign.metadata?.productDisplay`. The column is nullable, so
`?.` is required. Expose **only** this field; `goal`/`territories` stay
internal (today `buildCampaignRewardItem` reads nothing from `metadata` at all,
so this is the first and only leak, deliberately).

`MerchantReward` (`sdk/core/src/types/rpc/merchantInformation.ts`, after
`productScope`) — same field. `merchantRewardParity.ts` does an
optionality-insensitive key-set diff and hard-fails the build if the two sides
drift, so this is enforced rather than remembered.

Cache staleness after an edit is ≤30s cross-replica
(`activeRulesCache` TTL; `invalidateMerchantCache` evicts the local replica
only). Acceptable for cosmetic data.

### 4. `describeProductScope` — the generic piece

New in `sdk/core/src/rewards/`, alongside `matchesProductScope`.
Framework-agnostic, fail-open, display-only — the backend evaluator remains the
sole authority on eligibility.

Returns a **structured description, not a string**, so the wallet applies its
own i18n and the business app can reuse it:

```ts
type ScopeDescription = {
    /** From unkeyed entries — describes the campaign, not any one clause. */
    products: ProductDisplayItem[];
    logic: "all" | "any" | "none";
    clauses: ScopeClause[];
};

type ScopeClause = {
    polarity: "include" | "exclude";
    operator: ConditionOperator;
    field: string;
    /** Keyed entries whose `match` hit a value in this clause. */
    products: ProductDisplayItem[];
    /** Values with no keyed entry — rendered raw. */
    rawValues: (string | number | boolean)[];
};
```

Polarity derives from the existing `NEGATIVE_OPERATORS` set
(`sdk/core/src/rewards/operators.ts:57`) combined with `logic: "none"` — the
same classification already shared by the backend evaluator and publish-time
validation. That yields the *"si la commande contient / ne contient pas"*
wording.

This is not speculative generality: a **duplicate** humanizer already exists in
the business app (`ConditionChip` / `ConditionGroupDisplay` / `humanizeField`,
`CampaignDetailsSheet/ConfigTab.tsx:472-530`) rendering raw
`purchase › items › sku not in [...]` chips. This is the shared home for that
logic, and `ConfigTab` can migrate onto it later.

### 5. Explorer detail card

`CampaignInfoSection.tsx:141-147` — replace the bare `productScopeNote` row
with a clause-grouped block: a heading per clause (*"Only if the order
contains"* / *"…does not contain"*), then product rows (thumbnail via
`mediaSrcSet`, name, optional link).

Additive to `CampaignView` only. `useCampaignView` is shared with
`ExplorerCard`, a one-line list item with no room for this — do not touch the
existing singular fields.

Three fallbacks, all required:

1. clause with no resolved products → raw values (current behaviour)
2. no `productDisplay` at all → existing `productScopeNote` string
3. non-enumerable scope → generic polarity copy + campaign-level block

**Guard every URL with `isHttpUrl`** (`sdk/core/src/utils/product/sanitizeProducts.ts`)
at render. `ExternalLink` (`packages/wallet-shared/src/common/component/ExternalLink/index.tsx:27`)
binds `href` raw with no scheme check, despite a doc comment claiming
https/http/mailto/tel. Defence in depth alongside the schema pattern; reuse
that helper rather than writing a second one.

### 6. i18n, tests, changeset

Operator/polarity copy under `explorer.detail.productScope.*`, en + fr.

Tests:
- schema, including `javascript:`/`data:` rejection
- carve-out matrix: draft vs published, clearing with `[]`, foreign-field
  rejection
- `EstimatedRewardService` passthrough
- `describeProductScope`: nested groups, negation, keyed/unkeyed split, stale
  keyed entry renders nowhere
- `CampaignInfoSection` — **no test file exists today**

Changeset: `@frak-labs/core-sdk` minor.

## Out of scope

**Sharing page — untouched** (explicit decision). Later this goes into the
"How is my reward calculated?" FAQ answer. One trap to remember then:
`RewardBreakdown` returns `null` for fixed-only rewards
(`RewardBreakdown.tsx:35,61-65`), and the motivating 50 €/25 € case *is* fixed
— so the product block must sit **outside** that gate, as a sibling in
`SharingPage/index.tsx`, or it will vanish for exactly the merchant this
feature exists for. `describeProductScope` will already be available.

**Plural campaign selector.** `selectDisplayCampaign` / `selectBestReward` are
singular, so the explorer shows one campaign — the 50 € one — and hides the
25 € one. Fixing that is a follow-up, and `productDisplay` is its
**prerequisite**: a list rendered today would read "Campaign A — 50 €" /
"Campaign B — 25 €" off merchant-authored campaign names, which is ambiguous
noise rather than a product row.

When it lands: return all live campaigns ranked by existing `campaignRank`, no
dedupe (campaigns are additive at reward time, `RuleEngineService.ts:127`);
keep the upcoming-fallback singular; headline becomes "up to X". Note
`explorer.detail.step2Title` (*"Earn {{amount}} for every purchase…"*) is
already wrong for multi-campaign and needs an `_upTo` variant.

**Forward-compat rule:** `productDisplay` is an array on the *campaign*,
rendered by iterating — never `[0]`. Do **not** add a singular product field to
`BestReward` or `CampaignView`; `BestReward` already models "one winning
campaign", and entrenching that is precisely what the plural change must undo.

**Business dashboard** — see
`docs/plans/campaign-product-display-business-app.md`.

## Sequencing / shippability

Nothing here is breaking, and it can land in pieces at any time:

- **Backend** — optional field on an existing nullable `jsonb` column. No
  migration, no backfill. Existing campaigns read `undefined` and behave as
  today.
- **Business app** — purely additive; it never sends the field and the backend
  never requires it.
- **Wallet** — needs a fallback regardless (campaigns without `productDisplay`
  will always exist), so "not shipped" and "campaign has none" are the same
  code path.
- **SDK** — optional field; the parity assertion only fires on drift.

One ordering constraint: **backend must land before the business-app authoring
UI**, which cannot send a field the API rejects. Wallet rendering can land any
time after the backend, or never.

Within this plan: steps 1–3 are backend and independently shippable. Step 4 is
pure logic, unit-testable with no UI. Step 5 depends on 4.

## Note on branch state

At planning time the working tree carried **uncommitted** SDK WIP that this
plan assumes: `useProductScopeTarget` and `sharingPageProducts.ts` deleted and
replaced by a plural products API — `ProductDetails`
(`sdk/core/src/types/product.ts`), `SharingPageProduct = ProductDetails & {...}`,
`SelectDisplayCampaignOptions.products?`, and
`DisplayCampaign.matchedProducts` / `BestReward.matchedProducts`
(`select.ts:33,58,248`).

`matchedProducts` is currently consumed by **zero** UI surfaces. Also note
`selectFormattedReward` (`useEstimatedReward.ts:48`) takes no `products`
parameter, so `sharing.tsx` cannot thread the page's product array into reward
selection — a one-parameter gap, relevant only when the sharing page is picked
up.

Confirm that WIP is intended to land before starting.
