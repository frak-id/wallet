# Business app: `productDisplay` authoring (handoff)

Out of scope for the backend/wallet change that introduces
`metadata.productDisplay`. This documents what the business dashboard must
build for merchants to actually author the data.

Companion plan: `docs/plans/campaign-product-display.md`. Scope background:
`services/backend/docs/product-scoped-campaigns.md`.

## What exists after the backend change

`CampaignMetadata.productDisplay?: ProductDisplayItem[]` (max 20):

```ts
type ProductDisplayItem = {
    /** Optional. Ties this entry to a productScope value on the same field. */
    match?: { productId?: string; sku?: string };
    name: string;      // required, maxLength 120
    url?: string;      // https:// only, maxLength 2048
    imageUrl?: string; // https:// only, maxLength 2048
};
```

Purely cosmetic: it never affects matching, eligibility or payout. The
`rule.productScope` predicate remains the sole authority on which line items
earn a reward.

`match` drives where the wallet renders the entry:

- **keyed** (`match` present) → rendered inside the scope clause containing
  that `productId`/`sku` value
- **unkeyed** (`match` absent) → rendered as a campaign-level block

An entry whose `match` corresponds to no value in the current scope is
rendered **nowhere** (it must not fall back to campaign level — that would
advertise a product the campaign no longer covers). See below.

## Required UI work

### 1. Authoring step in the campaign wizard

Wizard steps live in
`apps/business/src/module/campaigns/component/Creation/` (`wizardSteps.ts`
orders them). `productScope` itself has **no** creation UI yet — it is listed
as open question #3 in the backend doc. So either:

- build `productScope` + `productDisplay` together in one "Products" step, or
- build `productDisplay` alone now and author `productScope` via API until the
  scope editor lands.

Recommended: one step, shown only when the campaign trigger is `purchase`.
Per row — name (required), PDP URL, image. Cap at 20 rows.

### Two authoring modes, driven by the scope shape

The merchant should never type a SKU into a matcher field by hand. Derive the
mode from the scope:

- **Enumerable scope** (`eq`, `in`, `not_in` on `productId`/`sku`) → render one
  row per scope value, with `match` auto-populated and shown read-only next to
  the row (e.g. a `SKU-A-S` chip). The merchant only fills name/url/image.
- **Non-enumerable scope** (`between`, `starts_with`, `contains`, or a scope on
  `name`/`quantity`/`unitPrice`) → free-form rows with **no** `match`. These
  describe the campaign as a whole.

A scope can produce both (e.g. `all: [{sku in [...]}, {unitPrice gt 50}]`) —
both sections can be present at once.

### Warn on stale entries

If the scope is edited (draft) or an entry's `match` no longer corresponds to
any scope value, the entry silently stops rendering in the wallet. The merchant
gets no feedback from the backend, so **the form must warn on save**: *"2
products no longer match this campaign's scope and won't be shown."*

### It can lie

**The rows are display-only and are not validated against `productScope`.**
Nothing stops a merchant naming "Blue Widget" on a campaign scoped to
`sku = WIDGET-RED`. Same trust level as the campaign `name` today. Worth an
inline hint ("This is what shoppers see — make sure it matches the products
you scoped above") rather than a validation rule.

### 2. Post-publish editing — the important bit

`productDisplay` is the **only** part of `metadata` editable after publish, and
`rule` stays fully locked. So the edit surface must be separate from the
wizard: a published campaign shows a read-only rule summary plus an editable
product-display section.

**API contract, must be respected exactly:**

- Send `metadata: { productDisplay: [...] }` and **nothing else** on a
  non-draft campaign. The backend merges only `productDisplay` onto the stored
  metadata and ignores `goal` / `specialCategories` / `territories`.
- Do **not** round-trip the full cached `metadata` object. Other fields would
  be silently dropped (the backend rejects them loudly only if it detects
  them — see the guard in `CampaignManagementService.update`).
- To clear the list, send an explicit `productDisplay: []`. Omitting the key
  means "leave unchanged" (`cleanUpdates` filters `undefined`).

Concurrent edits are last-write-wins on the whole array (documented, accepted).
Avoid double-submit; consider disabling the save button while in flight.

### 3. Image upload

Reuse the existing media endpoint rather than free-text URLs:
`POST /business/:merchantId/media/upload` with `type: "icon"`
(`services/backend/src/api/business/merchant/media.ts:27`) already does
content-hash-suffixed storage so merchants build a reusable library to pick
from — exactly this use case. Uploaded URLs land on `cdn.gcp.frak.id`, which is
what makes the wallet's `mediaSrcSet` responsive variants work.

A free-text `imageUrl` still validates, but external hosts get no `-sm`/`-md`
variants and load full-size on mobile.

### 4. URL validation in the form

Backend enforces `https://` only. Mirror it client-side for a decent error
message instead of a 422. **Do not** rely on `type="url"` or a `format: "uri"`
equivalent — that accepts `javascript:` and `data:` (verified). Check the
scheme explicitly.

### 5. Campaign list indicator

Still-open item #3 from the backend doc: no "product-scoped" indicator exists
on the campaign list (`component/TableCampaigns/`). With `productDisplay`
present, a product thumbnail + name is a better cell than a generic badge.
Note `CampaignListItemSchema` deliberately omits `metadata`, so this needs the
field added to the list response first.

## Testing

`apps/business/src/module/campaigns/` uses colocated `*.test.tsx`. Cover:
publish-then-edit only sends `productDisplay`; clearing sends `[]`; non-https
URL is rejected in-form; the 20-row cap; enumerable scope auto-populates
`match`; non-enumerable scope omits it; stale-entry warning fires.

## Possible reuse: condition rendering

`CampaignDetailsSheet/ConfigTab.tsx:472-530` (`ConditionChip`,
`ConditionGroupDisplay`, `humanizeField`) already humanizes rule conditions
into raw chips like `purchase › items › sku not in [...]`. The companion plan
adds `describeProductScope` to `sdk/core/src/rewards/` as a shared, structured
(non-string) description of a scope. Once it exists, `ConfigTab` can migrate
onto it and both surfaces stop drifting — and the wizard can use it to derive
the enumerable/non-enumerable split above rather than re-walking the tree.

## Explicitly not required

- No migration. `metadata` is an existing nullable `jsonb` column; absent
  `productDisplay` is the current behaviour.
- No change to campaign economics, budget, or the publish flow.
