# Handoff Plan — System-Level Platform Admins (read-only, all-merchant access)

**Repo:** `frak-wallet` (SST v3 monorepo, Bun).
**Apps:** `services/backend` (Elysia.js + DDD), `apps/business` (TanStack Router SPA, Eden Treaty types).
**Mode:** implementation handoff. No code changed yet.

**Decisions locked in by the user (supersede the open questions in the other handoff docs):**
- **D1 — Identity key:** allow-list keys on **wallet address** (SIWE login, no email on session). ✅
- **D2 — Merchant selection:** **No dedicated lookup endpoint.** `GET /business/merchant/my` simply
  returns the **full merchant list** when the caller is a platform admin, so they can scroll through
  all merchants on the dashboard / home page. ✅
- **D3 — Audit:** structured `log` lines (no persisted audit table). ✅
- **D4 — Read-only scope:** admins can view **all** GET data (incl. bank balances, member PII). ✅
- **D5 — Read-only signal:** add a new **`"platform_admin"`** value to the `MerchantRole` union
  (cleaner than reusing `role === "none"`). ✅

---

## 1. What the feature should do (and non-goals)

**Goal.** A small, ops-controlled set of *platform admins* — identified on the backend via an SST
Secret allow-list of **wallet addresses** — can VIEW any merchant's dashboard + stats in **strict
read-only** mode for debugging, without mutating anything. The allow-list is the single trust root;
admin status is derived server-side on every request and never trusted from the client.

**In scope**
- Backend-derived `isPlatformAdmin` from an SST Secret allow-list, keyed on **wallet address**.
- Read access to ANY merchant's GET endpoints (dashboard, stats, campaigns, members, bank balances,
  media, etc.) for allow-listed wallets.
- Backend-enforced read-only: all mutations (`POST/PUT/PATCH/DELETE`) remain denied for admins on
  merchants they don't actually own/admin.
- `GET /business/merchant/my` returns the **full merchant list** for platform admins (D2), and an
  `isPlatformAdmin` flag, so the home page lists every merchant for selection.
- A new `"platform_admin"` role value surfaced on per-merchant data, driving frontend read-only UX.
- Frontend read-only UX: persistent banner + disabled mutation affordances (cosmetic only).
- Structured audit logging of every admin read bypass.

**Non-goals (explicit)**
- No email/OAuth admin identity; no new login flow; no change to Shopify or wallet/SDK auth.
- No per-merchant or granular RBAC redesign beyond adding the one `platform_admin` role value.
- No write/"act-as" capability for admins on foreign merchants — strictly read-only.
- No admin self-service management of the allow-list (it is a backend secret, ops-controlled).
- No separate impersonation JWT, no TTL session, no MFA, no persisted audit table.
- No dedicated `/admin/lookup` endpoint (dropped per D2).
- No "all merchants merged" stats views — each merchant is viewed individually by `:merchantId`.

---

## 2. What the external reference teaches (transferable)

From Pigment's "Impersonation Done Right" + Ory / Agnitestudio / PacketWanderer:

- **Read-only by default; backend is the source of truth.** UI disabling is cosmetic — "the button
  text is not a security boundary; the request path is." Every request must be re-checked server-side.
- **Derive admin status server-side, never trust the client.** Re-validate against the secret on
  every request so revocation is immediate (no re-login).
- **Default-deny mutations; classify safe vs unsafe centrally.** Method-based classification
  (GET/HEAD = read) is the simplest viable option; if uncertain, treat as a mutation and block
  (fail closed).
- **Audit trail is non-negotiable** — log who viewed which merchant, when. Internal tools often have
  weaker logging than customer routes; don't fall into that trap.
- **Secret linked only to the backend**, never bundled to the frontend.

**Deliberately NOT adopted** (heavier than this debug use case needs): separate impersonation JWT
with `act` claim, 30-min TTL auto-expiry, step-up MFA, persisted audit table, DB-level read-only
pools (Pigment themselves rejected the two-pool approach as too brittle). Noted as future hardening.

---

## 3. What the local codebase implies (key files & facts)

**Auth / session (SIWE → JWT in `x-business-auth`)**
- Login: `services/backend/src/api/business/auth.ts` — verifies SIWE, signs JWT `{ wallet, siwe, sub }`
  (1-week expiry) with `process.env.JWT_BUSINESS_SECRET`.
- Token schema: `services/backend/src/domain/auth/models/BusinessSessionDto.ts` — `{ wallet, siwe? }`,
  **no role field** (greenfield for platform roles).
- Per-request session: `services/backend/src/api/business/middleware/session.ts` —
  `businessSessionContext` `.resolve` exposes `businessSession {wallet}`, `shopifySession`, and the
  per-request closure **`hasMerchantAccess(merchantId): Promise<boolean>`**. `request` is available
  in the `.resolve` context (only `headers` is destructured today → the bypass is a one-function edit).

**Authorization choke point (the lever)**
- `services/backend/src/domain/merchant/services/MerchantAuthorizationService.ts`:
  - boolean `hasAccess(merchantId, wallet)` (lines ~65-68) — used by the session closure to gate
    **both reads and writes** across ~40 routes. **Keep this owner/admin-only.**
  - rich `checkAccess(merchantId, wallet)` → `{ hasAccess, isOwner, isAdmin, role }` — used to
    populate the `role` shown by `GET /:merchantId`. **This is where the `platform_admin` role is
    added (display only).**
  - `MerchantRole = "owner" | "admin" | "none"` (line ~5) → add `"platform_admin"`.
  - `getAccessibleMerchantIds(wallet)` (lines ~80-91) — drives member aggregation; keep admin
    scoping to the single targeted merchant, do not merge across tenants.

**Reads = GET, writes = non-GET (RESTful, grep-verified).** This is the property that makes a
method-aware single-point change safe. **Re-verify before merge** that no read is a POST and no GET
mutates.

**Merchant listing.** `GET /business/merchant/my` (`merchant/index.ts:90-138`) returns
`{ owned, adminOf }` built from `MerchantRepository.findByOwnerWallet` +
`MerchantAdminRepository.findByWallet`. For platform admins it must instead return **all merchants**
(needs a `MerchantRepository.findAll()`-style method if one doesn't exist).

**SST Secrets flow (env-var based, NOT `Resource.`)**
- Declared in `infra/config.ts` as `new sst.Secret("NAME")`.
- Wired into the `elysiaEnv` object in `infra/gcp/secrets.ts` (e.g. `JWT_BUSINESS_SECRET:
  jwtBusinessSecret.value`); `infra/gcp/backend.ts` mounts `elysiaEnv` wholesale via `envFrom`.
- Backend reads `process.env.*`. Comma-split precedent: `wellKnown.ts:15-20`
  (`ANDROID_SHA256_FINGERPRINT.split(",")`).

**Frontend**
- `apps/business/src/stores/authStore.ts` (`{token, wallet, expiresAt}`), `activeMerchantStore.ts`
  (`lastMerchantId`). API client `src/api/backendClient.ts` (Eden Treaty, auto-appends
  `x-business-auth`, clears on 401). Build-time config only — the admin flag must come from the
  backend per-user response.
- **Gate to relax:** `src/routes/_restricted/m/$merchantId.tsx:21-50` — `beforeLoad` redirects away
  if `merchantId ∉ owned ∪ adminOf`. Must allow arbitrary IDs when `isPlatformAdmin` (and with D2 the
  `/my` list already contains all merchants).
- Merchant switcher / list: `src/module/common/component/Header/AccountMenu/index.tsx`,
  `src/module/dashboard/hooks/useMyMerchants.ts`, `src/module/merchant/queries/queryOptions.ts`
  (`merchantQueryOptions`, `myMerchantsQueryOptions`; per-merchant `role` already flows here).

---

## 4. Recommended approach (KISS/DRY, backend = source of truth)

**Chosen design: one method-aware read bypass at the single authorization choke point.** Do NOT
touch the ~40 route call sites.

### 4a. Admin status derivation (new helper)
New `services/backend/src/domain/auth/services/PlatformAdminService.ts` (~25 lines): parse
`process.env.PLATFORM_ADMIN_WALLETS` (comma-separated) once at module load into a normalized
lowercased `Set<Address>`; export `isPlatformAdmin(wallet): boolean`. Empty/unset secret ⇒ always
`false` (feature inert, safe default). Invalid entries are logged + skipped, never throw. Use viem
`isAddressEqual`/lowercasing like `MerchantAuthorizationService`.

### 4b. Read bypass (the one functional gate change)
In `session.ts`, inside `hasMerchantAccess` (business-JWT branch only), after the existing
real-access check:

```ts
hasMerchantAccess: async (merchantId: string) => {
    // 1. Real relationship (owner / merchant-admin) — unchanged source of truth
    if (await MerchantContext.services.authorization.hasAccess(merchantId, session.wallet))
        return true;
    // 2. Platform-admin READ-ONLY bypass: safe methods only (GET, HEAD)
    if (isPlatformAdmin(session.wallet) && SAFE_METHODS.has(request.method)) {
        log.info(
            { wallet: session.wallet, merchantId, method: request.method, path: request.url },
            "platform-admin read-only access");   // D3 audit
        return true;
    }
    return false;
}
```

Why safest & smallest: writes are denied *by construction* (every mutation route gates on
`hasMerchantAccess`; the bypass fires only on GET/HEAD → admin POST/PUT/DELETE on a foreign merchant
hits the unchanged check → existing `403`). A misclassification fails CLOSED (blocks a read), never
opens a write. Shopify-session and unauthenticated branches are untouched.

### 4c. Role surface (D5)
- Add `"platform_admin"` to `MerchantRole` in `MerchantAuthorizationService.ts`.
- In `checkAccess`, after owner/admin checks, if not owner/admin but `isPlatformAdmin(wallet)` →
  return `{ hasAccess: true, isOwner: false, isAdmin: false, role: "platform_admin" }`.
  **This affects display/role only** — the write gate uses the separate boolean `hasAccess`, which
  stays owner/admin-only. (Verify writes don't gate on `checkAccess`; per local context they gate on
  the session closure's boolean `hasAccess`.)

### 4d. Full merchant list for admins (D2)
- In `GET /business/merchant/my` (`merchant/index.ts`): if `isPlatformAdmin(session.wallet)`, return
  **all merchants** (add a `MerchantRepository.findAll()` if needed) instead of just owned/adminOf,
  each carrying `role: "platform_admin"`. Always add `isPlatformAdmin: boolean` to the response.
- Update `MyMerchantsResponseSchema` (in `src/api/schemas/*`) accordingly.

### 4e. Frontend read-only UX (defense-in-depth, NOT the guard)
- Surface `isPlatformAdmin` + the `platform_admin` role from `/my` in `queryOptions.ts` (+ demo mock).
- New `useReadOnlyMerchant()` hook = `role === "platform_admin"`.
- Relax `_restricted/m/$merchantId.tsx` `beforeLoad` to allow arbitrary IDs for admins.
- Persistent "Read-only platform-admin view" banner + disable/hide all mutation affordances
  (campaign edit/publish, bank fund/withdraw, member/admin add/remove, settings save, media upload)
  — additive wrapping, no refactor.
- The home page / `AccountMenu` lists all merchants (already provided by the `/my` change); admin
  scrolls to pick one.

**Rejected alternatives:** (B) new `hasReadAccess` helper on every GET route — high churn, easy to
miss one; (C) grant admins full `hasAccess` + per-route write guards — inverts the safe default, one
miss = silent write hole; (D) separate admin console app — over-engineered. Option A keeps the
default for writes at "deny"; the bypass can only ever widen reads.

---

## 5. Concrete files likely to change

**Infra**
- `infra/config.ts` — `export const platformAdminWallets = new sst.Secret("PLATFORM_ADMIN_WALLETS");`
- `infra/gcp/secrets.ts` — import it; add `PLATFORM_ADMIN_WALLETS: platformAdminWallets.value` to
  `elysiaEnv`. (No `infra/gcp/backend.ts` change — it mounts `elysiaEnv` wholesale.)

**Backend (`services/backend`)**
- `src/domain/auth/services/PlatformAdminService.ts` *(new)* — parse + normalize secret; export
  `isPlatformAdmin(wallet)`.
- `src/api/business/middleware/session.ts` — method-aware `hasMerchantAccess` read bypass + audit log
  (business-JWT branch only).
- `src/domain/merchant/services/MerchantAuthorizationService.ts` — add `"platform_admin"` to
  `MerchantRole`; return it from `checkAccess` for allow-listed wallets (display only).
- `src/api/business/merchant/index.ts` — `GET /my`: return all merchants + `isPlatformAdmin` flag for
  admins. (Add `MerchantRepository.findAll()` if missing.)
- `src/api/schemas/*` — extend `MyMerchantsResponseSchema` with `isPlatformAdmin: t.Boolean()` and
  the `platform_admin` role value; update merchant `role` schema/union.
- Env typings (`src/global.d.ts` / `sst-env.d.ts` if env vars are typed) — add `PLATFORM_ADMIN_WALLETS`.
- Tests: `PlatformAdminService.test.ts` (new); session-middleware/merchant-route test asserting GET
  allowed + non-GET denied for an admin-only wallet, non-admin unaffected, real owner unaffected.

**Frontend (`apps/business`)**
- `src/module/merchant/queries/queryOptions.ts` — surface `isPlatformAdmin` + `platform_admin` role
  (+ demo mock).
- `src/module/merchant/hook/useReadOnlyMerchant.ts` *(new)* — `role === "platform_admin"`.
- Read-only banner component + guard mutation UI entry points (additive).
- `src/routes/_restricted/m/$merchantId.tsx` — relax `beforeLoad` gate for admins.
- `AccountMenu` / home merchant list — already fed by the `/my` change; ensure it renders the full
  list for admins.

**Untouched on purpose:** the ~40 `merchant/*.ts` route handlers, the boolean
`MerchantAuthorizationService.hasAccess`, `infra/gcp/backend.ts`, `authStore.ts`, Shopify/wallet/SDK
auth paths.

---

## 6. Constraints, security risks, validation

**Constraints / risks**
- **Read/write conflation (HIGHEST):** the boolean `hasAccess` gates both reads and writes. Mitigated
  by the method-aware bypass (only GET/HEAD ever opened) — keep boolean `hasAccess` owner/admin-only.
- **Role vs write gate (D5):** adding `platform_admin` to `checkAccess` must NOT make the boolean
  write gate return true. Verify writes gate on the session closure's boolean `hasAccess`, not on
  `checkAccess`.
- **GET = read assumption:** re-verify by grep before merge that no read is a POST and no GET mutates.
  A misclassified read fails closed (read blocked), never opens a write.
- **Tenant crossing / data leakage:** reads are scoped to the single targeted `merchantId`. Watch
  `getAccessibleMerchantIds`-driven member aggregation — keep admin scoping to one merchant.
- **Audit (D3):** log every admin read bypass `{wallet, merchantId, method, path, ts}` via existing
  `log` (`@backend-infrastructure`).
- **SIWE-signed mutations** (ownership transfer, `transfer.ts:88-180`) bypass the business session
  entirely — naturally excluded from admin paths.
- **Bad secret resilience:** invalid addresses logged + skipped, never throw.
- **Demo mode** (`isDemoMode`) bypasses auth client-side — ensure admin logic doesn't interact.
- **Full-list scale (D2):** `GET /my` returning all merchants is fine for current scale; if the
  merchant count grows large, revisit pagination later (out of scope now).

**Validation commands / tests**
- `cd services/backend && bun run typecheck && bun run lint && bun run test`
- New unit: `PlatformAdminService` parse/normalize; empty secret ⇒ `false`.
- New integration on a merchant route: admin-only wallet → GET `200`, POST/PUT/DELETE `403`;
  non-admin non-owner → GET `403`; real owner unaffected. `GET /my` as admin → full list +
  `isPlatformAdmin: true`.
- `cd apps/business && bun run test` (extend `_restricted.test.tsx`,
  `_restricted.integration.test.tsx`, `AccountMenu.test.tsx`, `useMerchant.test.ts`) + manual smoke:
  admin sees banner, controls disabled, full merchant list shows, foreign merchant loads read-only.
- Infra: `bunx sst diff` on a sandbox stage to confirm `PLATFORM_ADMIN_WALLETS` wires into `elysiaEnv`.
- Set value: `bunx sst secret set PLATFORM_ADMIN_WALLETS "0xabc...,0xdef..." --stage <stage>`.
- Eden Treaty types flow backend → `@frak-labs/backend-elysia` → `apps/business`; the `/my` +
  `role` changes ripple to FE types — typecheck both packages.

---

## 7. Remaining assumptions (decisions resolved; verify during implementation)

- All five product decisions (D1–D5) are resolved (see top of doc).
- Verify the exact location of `MyMerchantsResponseSchema` and the `role` schema/union in
  `src/api/schemas/*` and confirm `MerchantRepository` has (or needs) a `findAll()`.
- Verify writes gate on the session closure's boolean `hasAccess`, not `checkAccess`, before adding
  the `platform_admin` role to `checkAccess`.
- Confirm `request` is reachable in `session.ts` `.resolve` for the method check (local context says yes).

---

## 8. Implementation-ready meta-prompt (self-contained, for the next worker)

```
Implement "system-level platform admins" in the frak-wallet SST monorepo: an ops-controlled
allow-list of WALLET ADDRESSES that can VIEW any merchant's dashboard/stats in STRICT READ-ONLY
mode. Backend is the source of truth; UI changes are cosmetic. Keep the surface minimal — do NOT
touch the ~40 existing merchant route handlers, the boolean MerchantAuthorizationService.hasAccess,
backend.ts, authStore.ts, or Shopify/wallet/SDK auth.

DECISIONS (final): D1 key on wallet address. D2 NO lookup endpoint — GET /business/merchant/my
returns the FULL merchant list when caller is a platform admin (so the home page lists all). D3
audit via structured log lines. D4 admins can view ALL GET data. D5 add a new "platform_admin"
value to the MerchantRole union as the read-only signal.

CONTEXT YOU MUST RELY ON:
- Business auth = SIWE -> JWT { wallet, siwe, sub } in header x-business-auth (no role field).
- Every merchant route funnels through ONE per-request closure hasMerchantAccess(merchantId) in
  services/backend/src/api/business/middleware/session.ts, which delegates to the BOOLEAN
  MerchantContext.services.authorization.hasAccess(merchantId, wallet). `request` is available in the
  .resolve context. The rich checkAccess() computes the `role` shown by GET /:merchantId.
- Reads are GET, writes are POST/PUT/PATCH/DELETE (RESTful). Re-verify by grep before merge.
- Secrets: declare in infra/config.ts (new sst.Secret("NAME")), wire into elysiaEnv in
  infra/gcp/secrets.ts (NAME: secret.value); backend reads process.env.NAME. backend.ts mounts
  elysiaEnv wholesale — do not edit it. Comma-split precedent: wellKnown.ts.
- Frontend: apps/business is a TanStack Router SPA with Eden Treaty types; per-merchant `role`
  flows via merchant queries; gate at src/routes/_restricted/m/$merchantId.tsx blocks merchants not
  in owned∪adminOf.

DO:
1. infra/config.ts: export const platformAdminWallets = new sst.Secret("PLATFORM_ADMIN_WALLETS").
2. infra/gcp/secrets.ts: add PLATFORM_ADMIN_WALLETS: platformAdminWallets.value to elysiaEnv.
3. New services/backend/src/domain/auth/services/PlatformAdminService.ts: parse
   process.env.PLATFORM_ADMIN_WALLETS once at module load into a normalized lowercased Set<Address>;
   export isPlatformAdmin(wallet): boolean. Empty/unset => false. Invalid entries log+skip, never
   throw. Use viem isAddressEqual/lowercasing like MerchantAuthorizationService.
4. session.ts: in hasMerchantAccess (business-JWT branch only), after the existing real-access check,
   add: if isPlatformAdmin(session.wallet) && SAFE_METHODS(GET/HEAD).has(request.method) ->
   log.info({wallet, merchantId, method, path}, "platform-admin read-only access") and return true.
   Otherwise unchanged. Writes stay denied by construction. Keep boolean hasAccess owner/admin-only.
5. MerchantAuthorizationService.ts: add "platform_admin" to MerchantRole; in checkAccess, if not
   owner/admin but isPlatformAdmin(wallet) return role "platform_admin" (display only — do NOT make
   the boolean write gate true).
6. merchant/index.ts: GET /my — if isPlatformAdmin, return ALL merchants (add MerchantRepository.
   findAll() if missing), each role "platform_admin"; always add isPlatformAdmin: boolean to the
   response. Update MyMerchantsResponseSchema + the role schema/union in src/api/schemas/*.
7. apps/business: surface isPlatformAdmin + platform_admin role from /my in queryOptions.ts (+ demo
   mock); add useReadOnlyMerchant() = role==="platform_admin"; relax $merchantId.tsx beforeLoad to
   allow arbitrary IDs for admins; add a persistent "Read-only platform-admin view" banner and
   disable/hide mutation affordances (additive, no refactor); ensure the home/AccountMenu list renders
   the full merchant list for admins.
8. Tests: PlatformAdminService.test.ts (parse/normalize, empty=false); integration — admin wallet GET
   200 / POST,PUT,DELETE 403, non-admin non-owner GET 403, real owner unaffected, GET /my as admin =
   full list + isPlatformAdmin true; extend apps/business _restricted + AccountMenu + useMerchant
   tests for the relaxed gate + read-only UI.

DO NOT: grant writes to admins; trust any client-supplied admin flag; touch route handlers, the
boolean hasAccess, backend.ts, authStore.ts, or Shopify/wallet/SDK auth; merge merchant data across
tenants; introduce a separate impersonation JWT, TTL, or MFA.

VALIDATE:
- cd services/backend && bun run typecheck && bun run lint && bun run test
- cd apps/business && bun run test
- bunx sst diff on a sandbox stage to confirm PLATFORM_ADMIN_WALLETS wires into elysiaEnv
- Set value: bunx sst secret set PLATFORM_ADMIN_WALLETS "0xabc...,0xdef..." --stage <stage>
```

---

### Acceptance note
Planning/synthesis deliverable only. The artifacts produced are this handoff document and the three
supporting docs in `handoff/`. No source code was modified, no tests were run, nothing was staged.
