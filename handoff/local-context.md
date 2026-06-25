# Local Context — Platform Admin Read-Only Dashboard Access

Repo: `frak-wallet` (SST monorepo, Bun). Feature goal: system-level platform admins
(allow-list defined on backend via SST Secret / env var) who can view ANY merchant's
dashboard + stats in **strict read-only** mode for debugging, without mutating anything.

Stack: backend = Elysia.js + DDD (`services/backend`); dashboard = TanStack Router SPA
(`apps/business`); type-safe link via Eden Treaty (`@frak-labs/backend-elysia` types).

---

## 1) Authentication, session, identity propagation

**Business (merchant dashboard) auth = SIWE → JWT bearer in `x-business-auth` header.**

- Login: `services/backend/src/api/business/auth.ts:11-95`
  - `POST /business/auth/login` verifies a SIWE message+signature (viem), then mints a
    JWT via `JwtContext.business.sign({ wallet, siwe, sub })` (1-week expiry).
  - Response `{ token, wallet, expiresAt }` (`BusinessAuthResponseDto`).
- JWT factory: `services/backend/src/infrastructure/external/jwt.ts`
  - `JwtContext.business` (line 33-38) signs/verifies with `process.env.JWT_BUSINESS_SECRET`.
  - Token schema = `BusinessTokenDto` (`services/backend/src/domain/auth/models/BusinessSessionDto.ts:3-11`): just `{ wallet, siwe? }`. **No roles field.**
- Session resolution per request: `services/backend/src/api/business/middleware/session.ts`
  - `businessSessionContext` Elysia plugin (`.resolve`, lines 20-72) reads
    `x-business-auth` (business JWT) OR `x-shopify-session-token` (Shopify embedded app).
  - Exposes into route context: `businessSession` (`{ wallet }` | null),
    `shopifySession` (Shopify token | null), and a per-request closure
    **`hasMerchantAccess(merchantId) => Promise<boolean>`** (lines 30-34 / 48-56 / 67-70).
  - `businessAuthenticated` macro (lines 74-105) is a `beforeHandle` 401 gate (auth presence only, no merchant scope).
- Other auth flavors (wallet app, SDK) live in `src/infrastructure/macro/session.ts`
  (`x-wallet-auth`, `x-wallet-sdk-auth`) and `src/api/middleware/identity.ts`
  (`identityContext` resolves `identityGroupId`). **Not used by the business dashboard** —
  the business app authenticates exclusively via `x-business-auth`.

**Frontend identity/propagation** (`apps/business`):
- Token store: `src/stores/authStore.ts` — Zustand `persist` (`name: "business-auth"`),
  holds `{ token, wallet, expiresAt }`, `isAuthenticated()` checks expiry,
  `getSafeAuthToken()` (line 60+) returns token only if valid.
- API client: `src/api/backendClient.ts` — Eden Treaty `treaty<App>(BACKEND_URL).business`.
  - `headers()` auto-appends `x-business-auth: <token>` (lines 14-26).
  - `onResponse()` auto-clears auth on 401 (lines 29-37).
- Route guard: `src/middleware/auth.ts` — `requireAuth` (line 31) is a TanStack
  `beforeLoad` that redirects to `/login` when unauthenticated; returns
  `{ session: { wallet } }`. Demo mode bypasses auth (`isDemoMode()`).
- Restricted shell: `src/routes/_restricted.tsx:11` — `beforeLoad: requireAuth`. **Single
  central guard** — AGENTS.md explicitly forbids per-route guards.

---

## 2) Current merchant / tenant resolution + dashboard scoping

**There is no single "current tenant" on the session.** A user can own/admin multiple
merchants; the active merchant is carried in the **URL** (`:merchantId` path param) and
remembered client-side.

Backend:
- Routes are merchant-scoped by URL param. `merchantRoutes` (`src/api/business/merchant/index.ts`)
  mounts `GET/PUT /merchant/:merchantId`, plus sub-routers each prefixed
  `/:merchantId/...` (campaigns, members, bank, transfer, admins, explorer, sdkConfig,
  webhooks, media, allowedDomains, campaignOverview, campaignDetails).
- `GET /merchant/my` (`index.ts:90-138`) returns `{ owned, adminOf }` — the merchants a
  wallet can access. Built from `MerchantRepository.findByOwnerWallet` +
  `MerchantAdminRepository.findByWallet`.
- Member queries scope across **all** accessible merchant IDs:
  `src/api/business/merchant/members.ts:16-37` (`resolveAccessibleMerchantIds`) →
  `MerchantAuthorizationService.getAccessibleMerchantIds(wallet)`.

Frontend:
- Merchant-scoped routes live under `src/routes/_restricted/m/$merchantId/...`.
- Layout gate: `src/routes/_restricted/m/$merchantId.tsx:21-50` — `beforeLoad` prefetches
  `myMerchantsQueryOptions`, and if `params.merchantId` is not in `owned ∪ adminOf` it
  **redirects to the first accessible merchant** (or `/dashboard` if none). **This is the
  key frontend gate that currently makes "view any merchant" impossible for non-members.**
- Active-merchant memory: `src/stores/activeMerchantStore.ts` (persisted `lastMerchantId`),
  used by `src/module/common/utils/resolveActiveMerchant.ts` and legacy `/dashboard` redirect.
- Merchant data hooks/queries: `src/module/merchant/hook/useMerchant.ts`,
  `src/module/merchant/queries/queryOptions.ts` (`merchantQueryOptions`,
  `myMerchantsQueryOptions`). `MerchantData.role: "owner"|"admin"|"none"` is returned per merchant.

---

## 3) Authorization / access-control — where checks live

**Central service, scattered call-sites.** The authorization *logic* is centralized but
each route *calls* it manually.

- Core: `services/backend/src/domain/merchant/services/MerchantAuthorizationService.ts`
  - `checkAccess(merchantId, wallet)` → `{ hasAccess, isOwner, isAdmin, role }`
    (owner = `isAddressEqual(merchant.ownerWallet, wallet)`; admin via
    `MerchantAdminRepository.isAdmin`). Lines 19-63.
  - `hasAccess(merchantId, wallet)` (65-68), `hasAccessByDomain(...)` (Shopify, 70-78),
    `getAccessibleMerchantIds(wallet)` (80-91).
  - Wired in `src/domain/merchant/context.ts` as
    `MerchantContext.services.authorization`.
- The per-request `hasMerchantAccess` closure (session.ts) wraps `hasAccess`/`hasAccessByDomain`.
- **Call pattern (repeated in every route)**: `const ok = await hasMerchantAccess(merchantId); if (!ok) return status(403, "Access denied");`
  - Examples: `merchant/index.ts:46-50` (GET), `:146-149` (PUT), `campaignOverview.ts:29-33,68-72`,
    `admins.ts:25-28,93-99,140-143`, `transfer.ts:28-31`, `campaigns.ts:176,247,303,356,422,462,502,542,582` (every read+write).
  - Some write routes verify a **SIWE signature** instead of session access (ownership
    transfer initiate/accept in `transfer.ts:88-180`).

> **Critical constraint:** reads and writes use the **same** `hasMerchantAccess` guard.
> Granting platform admins via `hasMerchantAccess` would also grant write access. The
> read-vs-write split must be introduced deliberately (see §9).

---

## 4) Mutations (writes) — where a central write-guard could live

All writes are Elysia `POST/PUT/DELETE` handlers under `/business/merchant/...`, each
gated by `hasMerchantAccess` (or SIWE) then calling a domain service/repository:
- Merchant update: `merchant/index.ts:139-200` (`PUT /:merchantId`).
- Admins add/remove: `merchant/admins.ts` (`POST ""` 84-..., `DELETE /:wallet` 131-...).
- Campaign create/update/publish/pause/resume/archive/delete: `merchant/campaigns.ts`
  (POST/PUT/DELETE at lines 290,343,410,450,490,530,570).
- Bank, transfer, explorer, sdkConfig, webhooks, allowedDomains, media — analogous.

**No central write interceptor exists today.** Best central insertion points:
- (a) The `businessSessionContext` resolver could expose a `canWrite` flag /
  `assertWrite(merchantId)` alongside `hasMerchantAccess`, so handlers (or a macro)
  reject platform-admin writes uniformly.
- (b) An Elysia `onBeforeHandle`/macro keyed on HTTP method (`POST|PUT|DELETE|PATCH`)
  registered on `businessSessionContext` could reject mutating methods when the caller
  is a platform admin (defense-in-depth, app-wide). Note SIWE-signed mutation routes
  (transfer) don't use a business session, so they're naturally excluded from platform-admin paths.

---

## 5) Stats / analytics reads

- Member analytics: `merchant/members.ts` → `OrchestrationContext.orchestrators.memberQuery.queryMembers/countMembers` over accessible merchant IDs.
- Campaign overview KPIs: `merchant/campaignOverview.ts` →
  `OrchestrationContext.orchestrators.campaignOverview.getSummary/getAnalytics(merchantId, window, currency)`. Gated by `hasMerchantAccess`.
- Campaign detail stats: `merchant/campaignDetails.ts`, explorer: `merchant/explorer.ts`.
- Orchestrators live in `src/orchestration/` (singletons in `src/orchestration/context.ts`);
  underlying analytics source includes OpenPanel (`src/infrastructure/integrations/openpanel/`).
- All stats endpoints are reads gated by the same `hasMerchantAccess` 403 check → these
  are exactly the endpoints platform admins must be able to call.

---

## 6) SST Secrets — definition & consumption

- Secrets declared in `infra/config.ts:66-129` as `new sst.Secret("NAME")` (e.g.
  `jwtBusinessSecret = new sst.Secret("JWT_BUSINESS_SECRET")`).
- Injected into the backend runtime as **env vars** via `infra/gcp/secrets.ts` →
  `elysiaEnv` object (lines 76-160). Example: `JWT_BUSINESS_SECRET: jwtBusinessSecret.value`.
  Some secrets are inlined `new sst.Secret("X").value`; others imported from `config.ts`.
- Backend consumes them through **`process.env.*`** (no SST `Resource.` usage anywhere —
  grep for `Resource.` returned nothing in `services/backend/src`). e.g.
  `jwt.ts:35 process.env.JWT_BUSINESS_SECRET`, `wellKnown.ts:15-20` shows the
  comma-split-list pattern (`ANDROID_SHA256_FINGERPRINT.split(",")`).
- `sst.config.ts` only routes which infra files import per stage (gcp/dev/example/shopify);
  the actual secret→env wiring is in `infra/config.ts` + `infra/gcp/secrets.ts`.

**Allow-list pattern to follow:** add `export const platformAdminWallets = new sst.Secret("PLATFORM_ADMIN_WALLETS")` in `infra/config.ts`; add `PLATFORM_ADMIN_WALLETS: platformAdminWallets.value` to `elysiaEnv` in `infra/gcp/secrets.ts`; read+parse `process.env.PLATFORM_ADMIN_WALLETS` (comma-separated, lowercased addresses) in a small backend helper. Mirrors the existing `ANDROID_SHA256_FINGERPRINT` split pattern.

---

## 7) Existing roles / permissions concepts

- Only per-merchant roles exist: `MerchantRole = "owner" | "admin" | "none"`
  (`MerchantAuthorizationService.ts:5`, surfaced as `role` on `GET /merchant/:merchantId`
  and `MerchantData.role` in the frontend).
- `merchantAdmin` table (`MerchantAdminRepository`) stores wallet-level admins per merchant.
- **No global/platform/system role anywhere.** `grep` for platform-admin/superadmin/allow-list
  found nothing relevant. The JWT business token has no role claim. This is greenfield.

---

## 8) Frontend — current user & what to show; merchant-switcher plug-in point

- Current user = wallet from `authStore` + `myMerchants` query (`owned`+`adminOf`).
- Merchant switcher UI: `src/module/common/component/Header/AccountMenu/index.tsx`
  - Lists `merchants` from `useMyMerchants()` (`src/module/dashboard/hooks/useMyMerchants.ts`
    → `myMerchantsQueryOptions`).
  - Active merchant from `useParams().merchantId` ∪ `activeMerchantStore.lastMerchantId`.
  - Switch link target built by `src/module/common/component/Header/AccountMenu/switchTarget.ts`.
  - **This is where a platform-admin "view any merchant" entry / search box plugs in.**
- The `/m/$merchantId` layout gate (`$merchantId.tsx:21-50`) currently hard-blocks merchants
  not in `owned ∪ adminOf`. For platform admins this gate must allow arbitrary IDs (e.g.
  backend `myMerchants` includes a platform-admin flag, or a separate "all merchants"/lookup
  query is used when the caller is a platform admin).
- Read-only UX: hide/disable all mutation affordances (campaign edit/publish, bank ops,
  admin add/remove, settings save). Components live under `src/module/{campaigns,merchant,members,settings}/`.

---

## Smallest-impact integration plan (proposed)

Backend (authoritative — must enforce regardless of UI):
1. Add `PLATFORM_ADMIN_WALLETS` secret (`infra/config.ts` + `infra/gcp/secrets.ts`) and a
   parser helper (e.g. `services/backend/src/domain/merchant/services/PlatformAdminService.ts`
   or a util reading `process.env`). Normalize to lowercased address set.
2. Extend `MerchantAuthorizationService` (or the `businessSessionContext` resolver) so a
   platform-admin wallet gets **read** access to any merchant, while keeping a **separate**
   `canWrite`/`assertWrite` that platform admins fail. Keep `hasMerchantAccess` semantics
   for existing members; introduce `hasReadAccess` vs `hasWriteAccess` to avoid the
   read/write conflation noted in §3.
3. Add a central write rejection for platform admins — either a method-based macro on
   `businessSessionContext` (reject `POST/PUT/DELETE/PATCH` when caller is platform-admin-only)
   or replace `hasMerchantAccess` in write handlers with `hasWriteAccess`. The macro is
   lower-touch and centrally auditable.
4. Surface platform-admin status to the frontend: extend `GET /merchant/my` response and/or
   `GET /merchant/:merchantId` `role` (e.g. add `"platform_admin"` / a `readOnly` flag), and
   provide a lookup so admins can target arbitrary merchant IDs (the existing `my` only lists owned/adminOf).

Frontend:
5. Relax `/m/$merchantId` `beforeLoad` gate for platform admins (allow unknown IDs when a
   platform-admin flag is set), add a merchant lookup/search in `AccountMenu`.
6. Drive a global read-only mode from the backend flag; gate all mutation UI + the Eden
   client (optionally short-circuit mutating calls client-side) — but treat client-side as UX only.

---

## Tests / validation paths
- Backend unit tests: `services/backend/test/` + co-located `*.test.ts`
  (e.g. `MerchantResolveService.test.ts`, `AdminWalletsRepository.test.ts`). Run `bun run test`
  in `services/backend` (Node env, sequential). Add tests for: platform-admin read allowed,
  platform-admin write denied (per HTTP verb), non-admin unaffected.
- Frontend: `apps/business` Vitest project (`bun run test`); existing
  `_restricted.test.tsx`, `_restricted.integration.test.tsx`, `AccountMenu.test.tsx`,
  `useMerchant.test.ts` are the patterns to extend for the relaxed gate + read-only UI.
- Typecheck: `bun run typecheck` (tsgo) in each package; Eden Treaty types flow from backend
  → `@frak-labs/backend-elysia` → `apps/business` (response shape changes ripple to FE types).

## Risks / constraints
- **Read/write guard conflation (highest risk):** `hasMerchantAccess` gates both reads and
  writes; a naive allow-list injection grants writes. Must split read vs write before/with the feature.
- **SIWE-signed mutations** (ownership transfer) bypass the business session entirely — they
  can't be triggered by a platform-admin session anyway, but don't assume the session macro covers them.
- **Build-time frontend config:** `apps/business` bakes config at build (`vite.config.ts`
  `define`); no runtime env. Anything FE-config-driven needs a rebuild, but the platform-admin
  flag should come from the backend per-user response, not FE env.
- **Cross-merchant data leakage in member queries:** `getAccessibleMerchantIds` drives
  `members` aggregation; platform-admin scoping there must be explicit (single targeted
  merchant, not "all merchants merged").
- **Audit/observability:** read-only admin access to arbitrary merchants is sensitive —
  consider logging platform-admin access (no existing audit log found).
- **Demo mode** (`isDemoMode`) bypasses auth client-side; ensure platform-admin logic doesn't
  interact with demo paths.

## Open questions
- Should platform-admin merchant targeting reuse/extend `GET /merchant/my` (add a flag +
  lookup) or add a dedicated admin lookup endpoint? `my` currently only lists owned/adminOf.
- Desired identity of platform admins: by wallet address (matches SIWE/business JWT `wallet`) — confirm.
- Read-only enforcement scope: block all `POST/PUT/DELETE` under `/business/merchant`, or
  allow a curated safe-list? Method-based blanket block is simplest/safest.
- Should the platform-admin role appear in the `role` union or a separate `readOnly` boolean
  (impacts Eden types + existing `MerchantData.role` consumers)?