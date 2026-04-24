# Referral Code — Backend Design (Phase 1)

## Goal

Let any wallet user become a referrer by creating and sharing a 6-digit code.
When a different user redeems that code, a **cross-merchant referrer relationship** is recorded at the identity-group level. This relationship feeds the existing rewards pipeline as the referrer of last resort: merchant-scoped referrals always take precedence.

Out of scope for Phase 1 (but designed for — see [Phase 2 hooks](#phase-2-hooks)):

- Frak paying influencers per install.
- Referral codes pinned to a merchant / category.
- Time-bounded cross-merchant referrers.
- Explicit "erase-by-direct" logic (emerges naturally from the schema).

---

## Context

### What already exists

| Concept | Location | Behaviour |
| --- | --- | --- |
| 6-digit code primitive | `services/backend/src/domain/identity/{services,repositories}/InstallCode*` | `nanoid` `customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6)` (excludes `0/O/1/I/L`). Batch-candidate insertion (50 candidates, `NOT EXISTS` + `ON CONFLICT DO NOTHING`) for collision resistance. 72 h TTL. Rate-limited. |
| Merchant-scoped referrer relationship | `services/backend/src/domain/attribution/db/schema.ts` — `referral_links` | `UNIQUE (merchant_id, referee_identity_group_id)`. One referrer per user per merchant. Chain walk via recursive CTE with path-based cycle detection. |
| Attribution events | `services/backend/src/domain/attribution/db/schema.ts` — `touchpoints` | Per-merchant arrival events (referral link clicks, organic, paid ad, direct). Drives `AttributionService.attributeConversion`. |
| Identity as an account abstraction | `services/backend/src/domain/identity/db/schema.ts` — `identity_groups` / `identity_nodes` | `identity_groups.id` is the cross-merchant user identity. Wallets are global `identity_nodes` (`merchantId = NULL`). |
| Reward pipeline integration point | `orchestration/reward/InteractionContextBuilder.ts:28-50` | Resolves `referrerIdentityGroupId` on the attribution context. Consumed by `BatchRewardOrchestrator` and `RuleEngineService` (`fetchReferralChain` callback). |

### What a referral code is — conceptually

A referral code redemption is **not a touchpoint** — it is not an arrival event. A user might redeem a code from Settings months after their first merchant interaction.

A referral code redemption **is** a referrer relationship, identical in shape to a merchant-scoped referral except for two dimensions:

- **Scope** — applies across all merchants (including ones that don't exist yet) instead of a single merchant.
- **Origin** — was created via code redemption instead of a click-through link.

Therefore the natural home for the relationship is the existing `referral_links` table, extended with an explicit `scope` and `source`. The code itself gets a dedicated lightweight domain.

---

## High-level decisions

| Question | Decision |
| --- | --- |
| Active codes per owner | One. Rotation archives the old row; redemptions against the old code still resolve via `referral_code_id`. |
| Redemption window | First redemption wins. No switching later. Matches existing `ReferralService` "first referrer wins" semantic. |
| Who can create a code | Any wallet-connected user, opt-in via Settings action (`POST /issue`). The existence of an active row is itself the opt-in marker — no separate flag on `identity_groups`. |
| Code format | Reuse exact install-code alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`) and length (6). ~29⁶ ≈ 594 M values. |
| Phase 1 reward wiring | Wired into `InteractionContextBuilder`. Cross-merchant referrer becomes the referrer-of-last-resort in reward context. |
| `install` interaction type | Deferred. Added only when the influencer-payout feature is built. |
| Integration approach | Blend at the data layer: extend `referral_links` with `scope` + `source` rather than creating a parallel table. |
| Terminology | `scope: 'merchant' \| 'cross_merchant'`. Drop "super referrer" — it's just a referrer with cross-merchant scope. |
| Revocation grace period | Revoked rows remain redeemable for **14 days** and block re-issuance of the same 6-char string; a daily cron (`cleanupExpiredRevokedReferralCodes`) deletes them afterwards, freeing the string for reuse. |
| Rate limits | Every write route stacks IP + identity-group buckets. `/code/redeem` capped at **10 req/min/IP** plus 5/hour/identity. See [API > Rate limits](#rate-limits). |
| Status endpoint scope | Global: single `GET /user/wallet/referral/status?merchantId=<optional>` returns owned code + cross-merchant referrer + merchant referrer in one payload. |

---

## Schema

### New: `referral_codes` (new `referral-code` domain)

Lives in a dedicated domain because its concerns (code lifecycle, issuance, revocation) are orthogonal to the relationship itself.

```ts
// services/backend/src/domain/referral-code/db/schema.ts

referral_codes {
  id                        uuid PK
  code                      varchar(6) NOT NULL
  owner_identity_group_id   uuid       NOT NULL
  created_at                timestamp  NOT NULL DEFAULT now()
  revoked_at                timestamp                       // rotation / opt-out marker
}

// Partial uniques:
UNIQUE INDEX (code)                                         WHERE revoked_at IS NULL
UNIQUE INDEX (owner_identity_group_id)                      WHERE revoked_at IS NULL

// Supporting indexes:
INDEX (owner_identity_group_id)
```

Notes:

- Partial unique on `code WHERE revoked_at IS NULL` keeps history addressable by `id` / FK while guaranteeing only one *active* row may hold a given code.
- Partial unique on `owner_identity_group_id WHERE revoked_at IS NULL` enforces "one active code per owner" without preventing rotation history.
- Revoked rows stay redeemable (and block re-issuance of the same 6-char string) for **14 days** — the grace period. A daily cleanup cron deletes rows whose `revoked_at` predates the window; the string becomes available for a fresh owner afterwards. Enforced in `ReferralCodeRepository.create` by widening the collision check to `revoked_at IS NULL OR revoked_at > now() - interval '14 days'`.

### Extended: `referral_links` (existing `attribution` domain)

```ts
// services/backend/src/domain/attribution/db/schema.ts

referral_links {
  id                                uuid PK
  scope                             text  NOT NULL  // 'merchant' | 'cross_merchant'
  merchant_id                       uuid            // NULL iff scope='cross_merchant'
  referrer_identity_group_id        uuid  NOT NULL
  referee_identity_group_id         uuid  NOT NULL
  source                            text  NOT NULL  // 'link' | 'code'
  referral_code_id                  uuid            // FK referral_codes.id, only when source='code'
  created_at                        timestamp NOT NULL DEFAULT now()
  expires_at                        timestamp                 // Phase 2 hook — unused in P1
}

CHECK (
  (scope = 'merchant'       AND merchant_id IS NOT NULL) OR
  (scope = 'cross_merchant' AND merchant_id IS NULL)
)

// Replaces existing UNIQUE (merchant_id, referee_identity_group_id):
UNIQUE INDEX (merchant_id, referee_identity_group_id) WHERE scope = 'merchant'
UNIQUE INDEX (referee_identity_group_id)              WHERE scope = 'cross_merchant'

// Existing supporting indexes preserved:
INDEX (referrer_identity_group_id)
INDEX (referee_identity_group_id)
```

Notes:

- `scope` + `source` together describe the referrer type. `scope` affects lookup logic; `source` is purely informational (analytics, debugging).
- `merchant_id NOT NULL → NULLABLE` is the only behaviour-breaking change. Every reader must be audited (see [Read-path audit](#read-path-audit)).
- `expires_at` is schema-level future-proofing for time-bounded cross-merchant referrers. Always `NULL` in Phase 1.
- The partial uniques reproduce the existing per-merchant invariant and add the "one cross-merchant referrer per user" invariant in one declarative place.

---

## Domain layout

```
services/backend/src/domain/referral-code/
├── db/schema.ts                         # referral_codes
├── repositories/
│   └── ReferralCodeRepository.ts        # batch-candidate insert, lookup, revoke
├── services/
│   └── ReferralCodeService.ts           # issue / revoke / findActive* / findByCode
├── schemas/index.ts                     # Elysia/TypeBox request/response schemas
├── context.ts                           # ReferralCodeContext singletons
└── index.ts                             # public exports
```

Changes to existing domains:

- `attribution/db/schema.ts` — schema extended (see above).
- `attribution/repositories/ReferralLinkRepository.ts` — updated query shapes (see [Repository updates](#repository-updates)).
- `identity/repositories/InstallCodeRepository.ts` — consumes the shared primitive from `src/utils/sixDigitCode.ts`. No behaviour change.

New orchestrator for cross-domain composition (follows the `service → service` prohibition):

```
services/backend/src/orchestration/referral-code/
└── ReferralCodeRedemptionOrchestrator.ts
```

---

## Shared primitive: `sixDigitCode.ts`

Extract the constants and candidate generator out of `InstallCodeRepository` so both install codes and referral codes reuse the same alphabet, length, and collision-resistant batch insert.

```ts
// services/backend/src/utils/sixDigitCode.ts
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CANDIDATE_BATCH_SIZE = 50;
export const generateCode = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

export function generateCandidates(count = CANDIDATE_BATCH_SIZE): string[] {
    return Array.from({ length: count }, () => generateCode());
}
```

`InstallCodeRepository.create` and `ReferralCodeRepository.create` both call `generateCandidates()` and use the same `WITH candidates … INSERT … WHERE NOT EXISTS … ON CONFLICT DO NOTHING` SQL shape.

---

## Services

### `ReferralCodeService` (new — `referral-code` domain)

```ts
class ReferralCodeService {
  // 409 if owner already has an active code.
  issue(ownerIdentityGroupId: string): Promise<{ code: string; createdAt: Date }>;

  // Set revoked_at on active row; no replacement. Returns void.
  // During the 14-day grace window the code stays redeemable against its
  // original owner; callers that want a fresh code issue one separately
  // (frontend composes revoke + issue).
  revoke(ownerIdentityGroupId: string): Promise<void>;

  // Active row only, null if owner never issued or revoked.
  findActiveByOwner(ownerIdentityGroupId: string): Promise<ReferralCodeSelect | null>;

  // Any row matching the code — active OR revoked — used during redemption to
  // preserve the referrer relationship even if the code was revoked afterwards.
  findByCode(code: string): Promise<ReferralCodeSelect | null>;

  // Return up to `count` available 6-char codes that contain the 3- or
  // 4-char stem. Digit-only fills are preferred; letter-filled fallback is
  // appended when the digit namespace is too dense. Fill is placed at the
  // start or end of the stem only — no middle insertion.
  suggestWithStem(params: { stem: string; count?: number }): Promise<SuggestResult>;
}
```

### `ReferralCodeRedemptionOrchestrator` (new — orchestration)

Composes `ReferralCodeContext.services.referralCode` and `AttributionContext.repositories.referralLink` (cross-domain write — this is exactly why it lives in an orchestrator).

```ts
type RedemptionResult =
    | { success: true; referrerIdentityGroupId: string }
    | { success: false; code: "NOT_FOUND" | "SELF_REFERRAL" | "ALREADY_REDEEMED" | "WOULD_CYCLE" };

class ReferralCodeRedemptionOrchestrator {
    redeem(params: {
        code: string;
        refereeIdentityGroupId: string;
    }): Promise<RedemptionResult>;
}
```

Flow:

1. `referralCodeService.findByCode(code)` — `NOT_FOUND` if missing.
2. `owner === referee` — `SELF_REFERRAL`.
3. `referralLinkRepo.findByReferee(..., scope: 'cross_merchant')` — `ALREADY_REDEEMED` if present. (UNIQUE index is the final guard; this pre-check returns a friendlier error.)
4. `referralLinkRepo.wouldCreateCycle(ownerGroup, refereeGroup)` — `WOULD_CYCLE` if detected.
5. `referralLinkRepo.create({ scope: 'cross_merchant', source: 'code', referralCodeId, merchantId: null, … })`.

### Existing services — no signature changes

- `ReferralService` unchanged. It continues to handle merchant-scoped registration on referral-link arrival.
- `AttributionService` unchanged. Touchpoints remain merchant-scoped.

---

## Repository updates (`ReferralLinkRepository`)

### Preserve existing behaviour

- `findByReferee(merchantId, refereeId)` — add explicit `WHERE scope = 'merchant'`. Every current caller (`ReferralService.registerReferral`, `api/user/merchant/referralStatus.ts`) expects merchant-scoped semantics.
- `create(link)` — accept the wider insert shape; callers that don't set `scope` explicitly get `scope: 'merchant'` by default to avoid silent breakage.

### New methods

```ts
// Scope-aware resolver used by InteractionContextBuilder.
// Returns the effective referrer for this (merchant, user) context:
// merchant-scoped if present, else cross-merchant, else null.
findReferrerForReferee(
    merchantId: string,
    refereeIdentityGroupId: string,
): Promise<ReferralLinkSelect | null>;

// Scope-agnostic: treat the full graph as one. Conservative and cheap.
// Inserting (X → Y) of any scope is rejected if a path Y → ... → X exists in ANY scope.
wouldCreateCycle(
    referrerIdentityGroupId: string,
    refereeIdentityGroupId: string,
): Promise<boolean>;
```

### Unified chain walker

`findChain(merchantId, startId, maxDepth)` is rewritten as one recursive CTE with per-level scope priority:

```sql
WITH RECURSIVE chain AS (
    SELECT
        referrer_identity_group_id AS identity_group_id,
        1 AS depth,
        ARRAY[referee_identity_group_id, referrer_identity_group_id] AS path
    FROM (
        SELECT *
        FROM referral_links
        WHERE referee_identity_group_id = $startId
          AND (
              (scope = 'merchant' AND merchant_id = $merchantId)
              OR scope = 'cross_merchant'
          )
        ORDER BY (scope = 'merchant') DESC   -- merchant shadows cross-merchant
        LIMIT 1
    ) anchor

    UNION ALL

    SELECT
        next.referrer_identity_group_id,
        c.depth + 1,
        c.path || next.referrer_identity_group_id
    FROM chain c
    JOIN LATERAL (
        SELECT *
        FROM referral_links rl
        WHERE rl.referee_identity_group_id = c.identity_group_id
          AND (
              (rl.scope = 'merchant' AND rl.merchant_id = $merchantId)
              OR rl.scope = 'cross_merchant'
          )
          AND NOT rl.referrer_identity_group_id = ANY(c.path)
        ORDER BY (rl.scope = 'merchant') DESC
        LIMIT 1
    ) next ON TRUE
    WHERE c.depth < $maxDepth
)
SELECT identity_group_id, depth FROM chain ORDER BY depth;
```

Properties:

- `ORDER BY (scope = 'merchant') DESC LIMIT 1` at every level means merchant-scoped always wins when present for that merchant. Emergent "erase by direct": inserting a merchant row for an existing cross-merchant referee simply shadows it.
- `LATERAL` + `LIMIT 1` at each recursive step keeps the chain linear and deterministic.
- Path-based cycle guard preserved.
- LRU cache key is unchanged (`merchantId:startId:maxDepth`).

---

## Reward pipeline integration

### `InteractionContextBuilder` (`orchestration/reward/`)

```ts
// Before: touchpoint → identityNode → identityGroup (merchant-scoped only)
const referrerIdentityGroup = attribution.referrerIdentity
    ? await this.identityRepository.findGroupByIdentity(attribution.referrerIdentity)
    : null;

// After: touchpoint-derived resolution first, fall back to cross-merchant via referral_links
const touchpointReferrerId = attribution.referrerIdentity
    ? (await this.identityRepository.findGroupByIdentity(attribution.referrerIdentity))?.id ?? null
    : null;

const referrerIdentityGroupId =
    touchpointReferrerId
    ?? (await this.referralLinkRepository.findReferrerForReferee(merchantId, identityGroupId))
            ?.referrerIdentityGroupId
    ?? null;
```

### `BatchRewardOrchestrator`

No change. The callback `(args) => this.referralService.getReferralChain(args)` now returns a unified chain transparently because `findChain` was rewritten. `RuleEngineService`, `RewardCalculator`, `recipient: 'referrer'` rewards all behave as today.

### Attribution context surface

`InteractionContextResult.context.attribution` may optionally carry `referrerScope: 'merchant' | 'cross_merchant' | null` for analytics and future rule-engine predicates. Additive field, no consumer churn.

---

## Read-path audit

Every current reader of `referral_links`:

| Reader | File | Required change |
| --- | --- | --- |
| `ReferralLinkRepository.findByReferee` | `domain/attribution/repositories/ReferralLinkRepository.ts` | Add `WHERE scope = 'merchant'`. Preserves behaviour for all callers. |
| `ReferralService.registerReferral` | `domain/attribution/services/ReferralService.ts` | Caller of `findByReferee` + `create`. Ensure `create` defaults `scope: 'merchant'`, `source: 'link'`. |
| `api/user/merchant/referralStatus.ts` | `api/user/merchant/referralStatus.ts` | Caller of `findByReferee` — behaviour preserved (merchant-scoped only). Consider whether the endpoint should *also* surface cross-merchant referrer status. Decision deferred. |
| `ReferralLinkRepository.findChain` | `domain/attribution/repositories/ReferralLinkRepository.ts` | Rewritten as unified walker (see above). |
| `ReferralLinkRepository.wouldCreateCycle` | `domain/attribution/repositories/ReferralLinkRepository.ts` | Signature changed to scope-agnostic (drop `merchantId` parameter). `ReferralService.registerReferral` updated accordingly. |
| Tests under `domain/attribution/**` | — | Update to reflect new signatures and add cross-merchant cases. |

---

## API (`src/api/user/wallet/referral/`)

All routes wallet-authenticated. Rate-limited with two complementary
buckets (see [Rate limits](#rate-limits)).

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/user/wallet/referral/code` | Current owner's active code | — | `{ code: string \| null; createdAt: string \| null }` |
| `POST` | `/user/wallet/referral/code/issue` | Issue a code (opt-in). Body optional: omit to get a random code, or pass `{ code }` to claim a specific one (typically one from `/code/suggest`). | `{ code?: string }` | `{ code; createdAt }` · `409 ALREADY_ACTIVE` if already owning a code · `409 CODE_UNAVAILABLE` if the requested code is taken · `400 INVALID_CODE_LENGTH \| INVALID_CODE_CHARS` |
| `DELETE` | `/user/wallet/referral/code` | Revoke active | — | `204` |
| `POST` | `/user/wallet/referral/code/redeem` | Redeem someone else's code | `{ code }` | `{ success: true }` or `400 { code: 'NOT_FOUND' \| 'SELF_REFERRAL' \| 'ALREADY_REDEEMED' \| 'WOULD_CYCLE' }` |
| `GET` | `/user/wallet/referral/code/suggest?stem=XXXX&count=N` | Suggest available codes containing a 3 or 4-char stem (digit-fill preferred, start/end placement only) | — | `{ suggestions: string[] }` or `400 { code: 'INVALID_STEM_LENGTH' \| 'INVALID_STEM_CHARS' }` |
| `GET` | `/user/wallet/referral/status?merchantId=<uuid>` | Global referral view for this wallet | — | `{ ownedCode; crossMerchantReferrer; merchantReferrer }` (each `\| null`; `merchantReferrer` only populated when `merchantId` is provided) |

Error responses follow the existing 400-with-coded-body convention from `installCode.ts`.

### Rate limits

Every write route stacks two complementary buckets:

- **Per-IP** via the existing `rateLimitMiddleware` — DDoS defence, unchanged shape.
- **Per-identity** via `createIdentityRateLimit` (new in `infrastructure/rateLimit/identityRateLimit.ts`) keyed on the caller's identity-group id — prevents a single user from fanning out across networks.

| Route | IP bucket | Identity bucket |
| --- | --- | --- |
| `POST /code/issue` | 5 / min | 5 / hour |
| `DELETE /code` | 5 / min | 5 / hour |
| `POST /code/redeem` | 10 / min | 5 / hour |
| `GET /code/suggest` | 10 / min | 20 / hour |

Read routes (`GET /code`, `GET /status`) are unlimited — safe to poll.

### Frontend flows

**Owner — random code**
```
POST /user/wallet/referral/code/issue        → { code, createdAt }
```

**Owner — personalised code (suggestion-driven)**
```
GET  /user/wallet/referral/code/suggest?stem=QUEN  → { suggestions: ["QUEN42", "23QUEN", …] }
(user picks one)
POST /user/wallet/referral/code/issue  { code: "QUEN42" }  → { code, createdAt }
                                                           → 409 CODE_UNAVAILABLE if someone claimed it first (TOCTOU window)
```

**Owner — swap to a new code**
```
DELETE /user/wallet/referral/code            → 204 (old code stays redeemable for 14 days)
POST   /user/wallet/referral/code/issue      → { code, createdAt }   // or with `{ code }` for a picked one
```

**Referee — accepting a code**
```
POST /user/wallet/referral/code/redeem  { code: "QUEN42" }  → { success: true }
```

---

## Phase 2 hooks

Designed into the schema. Untouched in Phase 1 code.

- **Time-bounded cross-merchant referrer** — `referral_links.expires_at`. All read queries must add `WHERE expires_at IS NULL OR expires_at > now()`; a follow-up can gate this behind a feature flag before widespread use.
- **Merchant-pinned referrer code** — a redemption with `scope = 'merchant'`, `source = 'code'`, explicit `merchant_id`. The partial unique `(merchant_id, referee_identity_group_id) WHERE scope='merchant'` already accommodates this. Category- or group-pinning likely needs a `scope = 'merchant_group'` value plus a resolver; defer until the merchant-category feature lands.
- **Influencer payouts per install** — add `'install'` to the rewards interaction type union, emit an install event on code redemption (or first-purchase-after-redemption, depending on product spec), add a dedicated `recipient: 'cross_merchant_referrer'` reward variant if behaviour should diverge from `recipient: 'referrer'`.
- **Explicit erase-by-direct** — already emergent. No work needed: inserting a merchant-scoped row for a user who has a cross-merchant referrer makes the unified chain walker prefer the merchant-scoped row for that merchant's reward distribution.

---

## Non-goals / explicit omissions

- No changes to `touchpoints` schema or semantics — code redemption is not an arrival event.
- No changes to `RuleEngineService`, `RewardCalculator`, campaign schema, or `asset_logs`.
- No changes to `InstallCodeService` behaviour; only shared constants extracted.
- No new cross-domain service imports. Cross-domain writes happen in `ReferralCodeRedemptionOrchestrator`.
- No user-facing creator profile (name, avatar, stats). Out of scope until the influencer-payout product decisions are made.

---

## Decisions log (follow-up round)

Resolved from the initial open questions:

1. **Status endpoint scope** — broadened to `GET /user/wallet/referral/status`. Returns owned code + cross-merchant referrer unconditionally, plus merchant-scoped referrer when `?merchantId=<uuid>` is supplied. One-stop shop for the wallet Settings UI.
2. **Revocation behaviour** — revoked codes stay valid for 14 days (the grace window). During that window, redemption still succeeds and resolves to the original owner; the same 6-char string is blocked from re-issuance. A daily cron (`cleanupExpiredRevokedReferralCodes`) deletes rows past the window and frees the string for reuse.
3. **Redemption rate limit** — 10 req/min/IP paired with a per-identity bucket of 5/hour/identity. The per-identity bucket (via `createIdentityRateLimit` in `infrastructure/rateLimit/identityRateLimit.ts`) is also applied to `POST /code/issue` and `DELETE /code` at 5/hour each.
4. **Rotation route dropped** — `POST /code/rotate` is gone. Composition of `DELETE /code` then `POST /code/issue` covers the use case without sacrificing anything: the 14-day grace window preserves continuity for outstanding shares, and the service-level `rotate` was never atomic anyway.

Routes moved from `/user/wallet/referral-code/*` to `/user/wallet/referral/{code/*,status}` to make room for the broader status endpoint.
