# Brand directory (B2C explorer) — impact map & build plan

Status: proposal · 2026-11-14

## Pitch, restated against the code

| Pitch | What already exists | Gap |
|---|---|---|
| Reference many French brands, browse by category | `merchants` + `explorerConfig` (logo, heroes, description) + `merchant_explorer_ranking.manualBoost`, `/user/merchant/explore`, wallet `module/explorer` | Explorer only lists merchants **with an active campaign** (`innerJoin campaignRulesTable`). No categories/labels, no search, sorting is a client reorder of page 1 only |
| 3 merchant states | `merchants.verifiedAt` (set by every registration path, read nowhere), `explorerEnabledAt` (listing toggle), active campaigns | No "unclaimed" row can exist: `merchants_owner_check` requires an owner |
| Merchant claims or asks removal | Registration with DNS / Shopify / setup-code proof, `OwnershipTransferService`, business Explorer page (toggle + editor + phone preview) | Registration 409s `DOMAIN_ALREADY_REGISTERED` on an existing row |
| UTM on redirect | `ExplorerDetail` already builds `utm_source=frak&utm_medium=explorer&utm_campaign=<id>` (+ `fmt` merge token) | Outbound click is not tracked, so it cannot be reported to the merchant |
| Upsell: "we sent you N users" | OpenPanel export client + per-merchant funnel (`CampaignOverviewOrchestrator`, `openpanel/funnels.ts`), `explorer_card_viewed`, `wallet_modal_opened{merchant_id}` | No explorer funnel for a merchant, no outbound event |
| Brand referral link → /install → friend installs → lands on brand | `/install?ref=CODE` (standalone + SPA), Play referrer `referralCode=`, onboarding redeem with `context: "onboarding"`, pending `navigation` actions, `/explorer/$merchantId` deep link | No brand param on the link; nothing routes to the brand after onboarding |
| Referrer earns €0.5–1, set by Frak admin, paid from Frak bank | **Done already**: Frak signup rule (`referral_signup` trigger on `FRAK_MERCHANT_ID`, referrer + referee fixed EURe, budget, `holdUntilReleased`, unlock delay), published from the internal Game page, paid by settlement from `FRAK_SHARED_CAMPAIGN_BANK` | Only the naming/UI home ("Frak Game: referral signup") |

So the reward and attribution pipeline already exists. What is missing is mostly listing breadth (unclaimed rows, categories, search), a claim branch, and a brand param on the existing referral link.

## Core decision: indexed brands are `merchants` rows

Recommended over a separate `brand_directory` table:

- Explorer query, `explorerConfig`, media upload, `ExplorerDetail`, favorites, ranking boost, business Explorer editor + phone preview, notifications deep link: all keyed on `merchants.id` and reused as is.
- Claiming is just giving an owner to a row that already exists, so content Frak curated survives the claim without a copy step.
- A separate table would need a union in the explorer, two content sources (directory vs `explorerConfig`), and a copy-on-claim. That means more code and two sources of truth.

State is **derived**, so the tier needs no new column:

```
partner  = EXISTS active campaign         ("set up": SDK + rewards)
verified = verified_at IS NOT NULL        (claimed / registered)
indexed  = verified_at IS NULL            (Frak-curated, no owner)
listed   = explorer_enabled_at IS NOT NULL (removal request = NULL it, row kept)
```

The importer is insert-only (`ON CONFLICT (domain) DO NOTHING`), so a brand that asked for removal is never resurrected.

### Schema delta (migration written by the DB team)

- `merchants_owner_check` → `owner_wallet IS NOT NULL OR owner_account_id IS NOT NULL OR verified_at IS NULL`.
- Backfill `verified_at = COALESCE(verified_at, created_at)` for every existing row **first**: `verified_at IS NULL` becomes meaningful and must not catch legacy merchants. Check prod with `SELECT count(*) FROM merchants WHERE verified_at IS NULL` before shipping.
- `categories text[]`, `attributes jsonb`, `siren varchar(9)`: see [Categories, attributes, card content](#categories-attributes-card-content).
- Indexed rows: `default_reward_token = EURe`, `bank_address NULL`, `product_id` computed from domain as usual.

### Places that must learn to skip unclaimed rows (do before the first import)

| Site | Why |
|---|---|
| `MerchantRepository.findAll` (cap 500) → `WHERE verified_at IS NOT NULL` | Feeds billing backfill, platform-admin `/my`, Shopify shop-domain auto-link. Thousands of indexed rows would push real merchants past the cap (billing silently skips the tail), and auto-link would grant Shopify shops `admin` on Frak's rows |
| `MerchantResolveService` (SDK resolve by domain/id) | A brand dropping the SDK without registering must not silently run against a Frak-held row. Reject unclaimed |
| `getMerchantPermissions` | Grant `platform_admin` **write** on unclaimed rows only, so admins curate them with the existing business Explorer editor instead of a new one |

Nothing else iterates merchants. `MemberQueryOrchestrator` and `IdentityWeightService` query by id or owner.

## Backend

1. **Explorer, split in two queries** (`ExplorerOrchestrator`):
   - `queryMerchants` stays as is (partners, rewards, views, popularity) and gains `categories`, `attributes`. This is the "displayed big" set; it is small, so client-side sort keeps working.
   - New `queryBrands({ q, category, attribute[], offset, limit })`: every listed row, any tier, lightweight shape `{ id, name, domain, explorerConfig, categories, attributes, tier, integration }`. No campaign pricing, no OpenPanel. `ILIKE` on name/domain for v1 (`pg_trgm` once volume needs it), `ORDER BY tier, manualBoost, name`. LRU key includes all params.
   - New `getBrand(id)` → same shape. Replaces the paging loop in `useGetExplorerMerchantById` (its own TODO asks for this), and serves the install page brand header and indexed-brand deep links.
   - Routes in `api/user/merchant/explorer.ts`. The `merchant-explorer` rate-limit bucket is 30/min/IP: search-as-you-type needs a debounce on the client and its own, larger bucket.
2. **Claim = registration.** In `MerchantRegistrationService.register`, when `findByDomain` returns a row with `verifiedAt === null`, run the same proofs (DNS TXT / Shopify session / setup code) then `merchantRepository.claim(id, { owner, defaultRewardToken, name })` as a conditional update `WHERE verified_at IS NULL` (race-safe). Then invalidate the explorer cache. That gives roughly 20 lines, and all of it is reused: business registration UI, Shopify embedded mint (a Shopify shop installing the app claims its brand automatically), post-registration side effects.
3. **Internal directory API** (`api/business/internal/directory.ts`, `platformAdminAuthenticated`): paginated list of unclaimed rows, create one, bulk import (CSV/JSON → insert-only), set categories/attributes/boost, delist. Merchant domain only, so api → repository directly; no orchestrator needed.
4. **Merchant explorer stats**: one more funnel definition on the existing OpenPanel funnel helper, filtered by `merchant_id`: card viewed → detail opened (`wallet_modal_opened` with `modal=explorerDetail`) → site visited (new event) → installs referred (`referral_signup_completed` with `brand_merchant_id`). Exposed on `GET /business/merchant/:id/explorer/stats`.
5. **Brand on signup** (attribution only): optional `brandMerchantId` on the redeem body → `referral_signup` interaction payload + `referral_signup_completed` property. No change to payout logic.

## Wallet

1. **Explorer page**: a search field, category chips and attribute filters on top. When the query is empty, a "Partners" section shows the existing `ExplorerCard` list from `queryMerchants`. Below it, an "All brands" infinite list of a new compact `BrandRow` (logo, name, tagline, top attributes, a "rewards" badge for partners). `useInfiniteQuery` on `queryBrands`.
2. **`ExplorerDetail`**: widen its prop to the lightweight brand shape (it only reads `id/name/domain/explorerConfig/integration`). For non-partners, skip `useCampaignView`/`useRewardOffer`/merge token and turn the primary CTA into "Share with a friend" (brand referral link, below). Add `explorer_brand_visited { merchant_id }` on the site link, and a discreet "Is this your brand?" link to `business.frak.id/…/new?domain=<domain>` (prefill only).
3. **Brand referral link**: `https://<wallet>/install?ref=<myCode>&b=<compactMerchantId>`.
   - Needs the user's referral code. On first share, reuse the existing auto-generate code sheet.
   - `parseInstallSearch` gains `b` (`expandCompactUuid`, like `m`). `InstallReferralCodeView` gets an optional brand header ("X recommends <brand>") via `getBrand`. Watch `assertEagerBundleBudget`.
   - Android: `buildPlayStoreInstallUrl` adds `brand=`; `useInstallReferrer` reads it and queues a pending `navigation` action to `/explorer/$id`, which onboarding already runs after register.
   - Open-app deep link: `install?ref=…&b=…`. A logged-in user goes straight to `/explorer/$b`; a logged-out one gets the pending navigation and then register.
   - iOS has no install referrer: best effort is to copy the full link (not just the code) to the clipboard and let the onboarding code field accept a pasted URL. The fallback is that the referral still counts and the friend lands on the wallet.
4. `useGetExplorerMerchantById` → single `getBrand` call (net LoC negative).

## Business

1. **Internal "Directory" page**: list/search unclaimed brands, a create form, CSV import, and an "Edit listing" link to the existing `/m/$id/merchant/explorer` page, writable thanks to the permission tweak above.
2. **Explorer page upsell**: a stats card (30-day views / opens / site visits / installs referred) plus a tier ladder (Indexed → Verified → Partner) whose CTA points at the existing setup-status / campaign creation flow.
3. **Registration**: `?domain=` prefill and "claim" wording when the backend says the domain is an unclaimed listing (expose `claimable` on the DNS-check/pre-registration call).
4. Move the signup-rule controls out of the Game section into a "Referral" section of Internal, so the reward the brand referral uses is no longer labelled as Frak Game.

## Categories, attributes, card content

### Categories

- **Two-level closed taxonomy**, about 12 top levels and 50 leaves (Mode › Chaussures, Beauté › Cosmétiques, Maison › Literie, Alimentation › Épicerie fine, …). Stored as leaf slugs in `categories text[]` (max 3, first = primary, shown on the card) with a GIN index. The tree lives in one constant in `packages/app-essentials`: a top-level filter expands to its leaves in code (`categories && $leaves`), so the DB never stores the hierarchy. Slugs are stable; renaming is i18n only.
- **Facets**: one cached `unnest(categories) … GROUP BY` query gives counts. Chips hide empty categories and show sizes.
- **Explorer home as rails**: a partners rail, then one rail per top category, from a single query (`ROW_NUMBER() OVER (PARTITION BY primary category ORDER BY tier, boost)` ≤ 10), cached. "See all" opens the filtered list. Filters live in `/explorer` search params (`?c=&a=&q=`) through `validateSearch`, so a filtered view is shareable and survives back.
- **Assignment**: CSV column at import. The NAF code from SIRENE can pre-suggest one. The merchant edits after the claim, still from the closed list.
- **Search scale**: `ILIKE` on a few thousand rows is milliseconds. Next steps when needed: keyset pagination, then `unaccent` + `pg_trgm` (French accents). No search engine before ~50k rows.

### Attributes (filters): facts with a source, never judgements

Since **27 Sep 2026** (EU 2024/825 "EmpCo", no transition period) these are unfair *in all circumstances*: generic environmental claims ("écologique", "green", "eco-friendly") without recognised excellent environmental performance, and **sustainability labels not based on a certification scheme or set up by a public authority**. A badge such as "Écologique" applied by Frak, on a surface Frak earns money from, *is* such a label. Fines start at 4% of turnover. So every attribute is a verifiable fact with its source:

| Kind | Examples | Source |
|---|---|---|
| Legal status | Société à mission, ESS, structure d'insertion (SIAE), Entreprise du Patrimoine Vivant, certified organic establishment | `recherche-entreprises.api.gouv.fr` (free, no key; returns `est_societe_mission`, `est_ess`, `est_siae`, `est_patrimoine_vivant`, `est_bio`, plus creation date, headcount band, NAF, head-office town) |
| Third-party certification | B Corp, EU Ecolabel, AB / Cosmos Organic, GOTS, Fairtrade, Origine France Garantie, Slow Cosmétique | Certifier's public directory, checked by an admin, with an expiry |
| Declared fact | Fabriqué en France / en Europe, seconde main / reconditionné, vegan | Brand's own published statement (evidence URL). Rendered as "declared by the brand". After a claim, the merchant declares it with evidence |

- **Storage**: `attributes jsonb` = `[{ key, source: "sirene" | "certifier" | "brand", evidenceUrl?, checkedAt, expiresAt? }]`, with a GIN `jsonb_path_ops` index and filtering via `attributes @> '[{"key":"b_corp"}]'`. One column, no new table; evidence travels with the claim.
- **SIREN first, not name matching**: a name search hits the wrong legal entity easily (a test query for "camif" returned *a* CAMIF entity flagged `est_societe_mission=false`). French sites must publish their SIREN in their mentions légales, so the import takes it from there, stores `siren`, and then queries by SIREN. A monthly cron re-syncs SIRENE-derived attributes and drops expired certifications.
- The listing criteria themselves ("why this brand is here") go on a published methodology page, framed as editorial selection, not as a label.

### Filling cards that have no reward

Two sources in scope; ratings are deferred (see below).

1. **Editorial content (do first)**: `explorerConfig` gains `tagline` ("Pourquoi on aime", one line), `priceRange` (1–3), `city`, `foundedYear` (the last two pre-filled from SIRENE). Drafted at import, LLM-assisted offline from the brand's own site and validated by a human; there is no LLM in the backend today and none is needed at runtime. It is cheap and has no legal risk, and curation is the real value of a directory.
2. **First-party Frak signals**: "N people discovered it on Frak this month" (OpenPanel views/visits, already cached per merchant), "saved by N" (favorites are local-only today, `zustand persist`; a sync endpoint is needed first), and for partners "N purchases via Frak". This is owned data that grows with usage.
**Deferred: ratings and reviews.** Notes for when this comes back:
- **Google Places API**: the only legal Google route, since scraping is banned. Only `place_id` may be stored; the rating must be fetched live, with Google attribution. `reviewSummary` gives "what customers like" (Enterprise + Atmosphere SKU, region-dependent). Google rates physical places, so it fits online-only brands poorly.
- **Trustpilot**: keyed by domain, and the paid Display API is the legal route.
- **The brand's own review provider** (Avis Vérifiés, Judge.me…), connected after a claim, as an upsell.
- **Never** scrape reviews and summarise them ourselves. Republishing reviews triggers L111-7-2 / D111-17 transparency obligations.

### Card anatomy (non-partner)

Logo · name · primary category · tagline · up to 2 attributes (certifications first) · city/founded · price range. The detail sheet adds the full attribute list with sources, the site link (UTM), "Share with a friend", and "Is this your brand?".

## Rough size

Backend ~400 LoC · wallet ~450 · business ~400, plus tests and i18n. Categories/attributes/card content add roughly backend +250 (facets, rails, SIRENE sync), wallet +200 (rails, filters, card slots), business +150 (attribute evidence form, category picker). Nothing in SDK, listener, plugins, or native.

## Phasing

0. **Hardening** (no product change): `verified_at` backfill + CHECK relax, `findAll`/resolve/permissions filters, `getBrand` endpoint replacing the paging loop.
1. **Directory**: categories/attributes columns, internal import + admin edit, `queryBrands`, wallet search/chips/rows, tier-aware detail, outbound event.
2. **Claim & upsell**: registration claim branch, stats endpoint + business card, wallet "Is this your brand?" link.
3. **Brand referral**: `b` param through install / Play referrer / deep link / pending navigation, share CTA. Independent of 1–2 and can ship first on current partners.

## Open decisions

1. **Public explorer?** The list API is already unauthenticated. Moving `/explorer` out of `_protected` (like `/draw`) is cheap, but a real SEO "reference" needs server-rendered pages: the wallet SPA has SSR off. That points to the landing (Astro) repo consuming `queryBrands`/`getBrand`.
2. **Separate reward for brand referrals?** v1 reuses the single signup rule (same amount, same budget). A distinct amount needs a new trigger (`brand_referral_signup`), because two live `referral_signup` rules would both pay (hence the existing `SIGNUP_RULE_ACTIVE` guard).
3. **Partner share CTA**: keep the fCtx link (merchant campaign reward on purchase) or switch to the install link? The redeem also sets the cross-merchant referrer, so the sharer may earn on later purchases anyway, depending on campaign attribution.
4. **Data sourcing & legal**: manual/CSV vs scraping; rehost logos/heroes in our bucket rather than hotlinking; legal review of listing brands and logos without consent (the opt-out path is the delist + claim flow above), of the attribute wording against EmpCo, and of origin claims ("Fabriqué" vs "Conçu en France").
5. **Duplicates across subdomains**: an indexed `brand.fr` and a registration of `shop.brand.fr` will both list. Either match the claim on the registrable domain or give admins a merge/delist tool.
