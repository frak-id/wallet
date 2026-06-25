# Implementation Strategy — System-Level Platform Admins (read-only merchant impersonation)

**Mode:** planning / review only. No code was changed.

## 0. Architecture facts grounding this proposal

- **Auth is wallet-based (SIWE), not email.** `apps/business` logs in via SIWE → backend
  `POST /business/auth/login` (`services/backend/src/api/business/auth.ts`) verifies the
  signature and signs a `JWT_BUSINESS_SECRET` JWT whose payload is `{ wallet, siwe, sub }`
  (`BusinessTokenDto` in `services/backend/src/domain/auth/models/BusinessSessionDto.ts`).
  → **A platform-admin allow-list must key on wallet `Address`, not email.** (See decision D1.)
- **Single central authorization choke point.** Every merchant route resolves
  `hasMerchantAccess(merchantId)` from the session middleware
  (`services/backend/src/api/business/middleware/session.ts`). That helper delegates to
  `MerchantContext.services.authorization.hasAccess(merchantId, wallet)`
  (`services/backend/src/domain/merchant/services/MerchantAuthorizationService.ts`), which
  returns true only for the real owner or a recorded merchant-admin (or shop-domain match for
  Shopify sessions). ~40 call sites across `merchant/*.ts` + `notifications.ts` all funnel
  through this one function.
- **Reads are GET, writes are non-GET.** Confirmed across `campaignOverview.ts` (GET summary/
  analytics), `merchant/index.ts` (GET `/:merchantId`, GET `/my`, PUT `/:merchantId`),
  `campaigns.ts`, `bank.ts`, `media.ts`, etc. The codebase is RESTful: GET = read, POST/PUT/
  DELETE/PATCH = mutation. This is the lever that makes a single-point change possible.
- **Secrets flow:** `infra/config.ts` declares `new sst.Secret(...)`; `infra/gcp/secrets.ts`
  composes `elysiaEnv` (a plain object of `secret.value`s); `infra/gcp/backend.ts` mounts that
  object as a k8s `Opaque` Secret via `envFrom`. Backend reads `process.env.*`. The frontend
  (`apps/business`) only needs `process.env.BACKEND_URL`; it does **not** need the allow-list.
- **Frontend session state:** `apps/business/src/stores/authStore.ts` holds `{ token, wallet,
  expiresAt }`; `activeMerchantStore.ts` remembers `lastMerchantId`. Merchant data is fetched
  via `myMerchantsQueryOptions` / `merchantQueryOptions`
  (`apps/business/src/module/merchant/queries/queryOptions.ts`). The `GET /:merchantId`
  response already carries a `role: "owner" | "admin" | "none"` field — a ready-made
  read-only signal.

---

## 1. Recommended design shape

### 1a. Where `isPlatformAdmin` is derived (backend, from the secret)
- New SST Secret **`PLATFORM_ADMIN_WALLETS`** = comma-separated lowercased wallet addresses.
- Backend parses it **once at module load** into a normalized `Set<Address>` in a tiny pure
  helper, e.g. `services/backend/src/domain/auth/services/PlatformAdminService.ts` exposing
  `isPlatformAdmin(wallet: Address): boolean` (uses `viem` `isAddressEqual`/lowercase compare,
  mirroring `MerchantAuthorizationService`). Empty/unset secret ⇒ always `false` (safe default).
- `isPlatformAdmin` is derived purely from the **JWT wallet** vs the allow-list — never from a
  client-supplied flag. It is recomputed on every request, so removing a wallet from the secret
  revokes access on next request (no re-login needed).

### 1b. How it flows to the frontend
- Extend the **`GET /business/merchant/my`** response with `isPlatformAdmin: boolean` (it is the
  query already loaded on dashboard bootstrap, so no new round-trip). The frontend stores it in
  the existing react-query cache; optionally mirror into a derived selector. No new persisted
  store field is required.
- The client treats `isPlatformAdmin` as **advisory UI state only** — the backend re-derives it
  on every request and is the source of truth.

### 1c. How merchant selection / override works
- Today `/merchant/my` returns only `owned` + `adminOf`. A platform admin needs to reach a
  merchant they have no relationship with. Recommended minimal path:
  - Add an **admin-only lookup endpoint** `GET /business/merchant/admin/lookup?q=<domain|id>`
    that returns matching `{ id, domain, name }`, guarded by `isPlatformAdmin` (403 otherwise).
    Keep it search/paginated — never dump all merchants.
  - The admin picks a result → frontend navigates to the existing
    `/dashboard/:merchantId` route. `merchantQueryOptions` loads it via the **read bypass**
    (section 2), and `role` comes back `"none"` → frontend enters read-only mode.
- `activeMerchantStore.lastMerchantId` continues to work unchanged for the selected merchant.

---

## 2. Read-only enforcement strategy (backend write-guard = source of truth)

**Core idea (KISS/DRY): one method-aware bypass at the single choke point.** Do **not** change
the ~40 route call sites. Modify only `hasMerchantAccess` inside
`services/backend/src/api/business/middleware/session.ts` so a platform admin is granted access
**only for safe HTTP methods**:

```
// inside .resolve, where `request` and `session.wallet` are available
hasMerchantAccess: async (merchantId: string) => {
    // 1. Real relationship (owner / merchant-admin) — unchanged source of truth
    if (await MerchantContext.services.authorization.hasAccess(merchantId, session.wallet))
        return true;
    // 2. Platform-admin READ-ONLY bypass: safe methods only
    if (PlatformAdminService.isPlatformAdmin(session.wallet)
        && SAFE_METHODS.has(request.method)) {        // GET, HEAD
        log.info({ wallet: session.wallet, merchantId, method: request.method },
                 "platform-admin read-only access");  // audit (section 5)
        return true;
    }
    return false;
}
```

Why this is the safest, smallest design:
- **Writes are denied by construction.** Every mutation route already gates on
  `hasMerchantAccess`. Because the bypass fires only on GET/HEAD, a platform admin viewing
  someone else's merchant hits the *unchanged* real-access check on POST/PUT/DELETE → `403`.
  No per-route allow/deny logic, no risk of forgetting a route.
- **Source of truth is the backend guard**, exactly as required. The UI cannot grant writes.
- `request` is already in the Elysia `.resolve` context; only `headers` is destructured today,
  so this is a one-function edit.
- The Shopify-session and unauthenticated branches are untouched (they have no `session.wallet`
  and are not platform admins).

**Secondary UI disabling (defense-in-depth, not the guard):**
- In `apps/business`, when `isPlatformAdmin && merchant.role === "none"`, render a persistent
  **"Read-only platform-admin view"** banner and disable/hide all mutation affordances
  (edit sheets, save buttons, fund/withdraw, campaign create/edit, member/admin management,
  media upload). Centralize via a small `useReadOnlyMerchant()` hook so each component reads one
  boolean rather than re-deriving.

---

## 3. Exact files likely to change (minimized surface)

### Backend (`services/backend`)
1. **`src/domain/auth/services/PlatformAdminService.ts`** *(new, ~25 lines)* — parse
   `process.env.PLATFORM_ADMIN_WALLETS` into a normalized `Set`, export `isPlatformAdmin(wallet)`.
2. **`src/domain/auth/context.ts`** — register the service under `AuthContext.services`
   (optional; can also import the function directly to stay even smaller).
3. **`src/api/business/middleware/session.ts`** — the one functional change: method-aware
   `hasMerchantAccess` bypass + audit log (only the business-JWT branch).
4. **`src/api/business/merchant/index.ts`** — (a) add `isPlatformAdmin` to the `GET /my`
   handler + `MyMerchantsResponseSchema`; (b) add the admin-only `GET /admin/lookup` route.
5. **`src/api/schemas/*`** — extend `MyMerchantsResponseSchema` with
   `isPlatformAdmin: t.Boolean()`, add a lookup response schema.
6. **`src/global.d.ts` / `sst-env.d.ts`** — add `PLATFORM_ADMIN_WALLETS` to the env typings if
   env vars are typed there.
7. **Tests:** `PlatformAdminService.test.ts` (new) and a session-middleware/merchant-route test
   asserting GET allowed + non-GET denied for an admin-only wallet.

### Infra
8. **`infra/config.ts`** — `export const platformAdminWallets = new sst.Secret("PLATFORM_ADMIN_WALLETS");`
9. **`infra/gcp/secrets.ts`** — import it and add `PLATFORM_ADMIN_WALLETS: platformAdminWallets.value`
   to `elysiaEnv`. (No `backend.ts` change — it mounts `elysiaEnv` wholesale.)

### Frontend (`apps/business`)
10. **`src/module/merchant/queries/queryOptions.ts`** — surface `isPlatformAdmin` from the
    `/my` response (and add to mock data for demo mode).
11. **New `src/module/merchant/hook/useReadOnlyMerchant.ts`** — returns
    `isPlatformAdmin && role === "none"`.
12. **A read-only banner component** + guarding the mutation UI entry points (edit sheets,
    bank actions, campaign/member/admin/media). These are the bulk of frontend touch points;
    keep additive (wrap existing buttons), do not refactor.
13. **Merchant-picker UI** for admins (calls `/admin/lookup`) — smallest form: a search box in
    the existing merchant switcher shown only when `isPlatformAdmin`.

**Untouched on purpose:** all `merchant/*.ts` route handlers, `MerchantAuthorizationService`,
`infra/gcp/backend.ts`, `authStore.ts`.

---

## 4. SST Secret definition + consumption steps

1. **Declare** in `infra/config.ts`:
   `export const platformAdminWallets = new sst.Secret("PLATFORM_ADMIN_WALLETS");`
2. **Set the value** per stage:
   `bunx sst secret set PLATFORM_ADMIN_WALLETS "0xabc...,0xdef..." --stage <stage>`
   (and for prod `--stage production`). Empty/unset ⇒ feature inert.
3. **Inject** by adding `PLATFORM_ADMIN_WALLETS: platformAdminWallets.value` to `elysiaEnv` in
   `infra/gcp/secrets.ts`. It then ships in the existing `elysia-secrets-*` k8s Secret via
   `envFrom` — no `backend.ts` edit.
4. **Consume** in `PlatformAdminService.ts` via `process.env.PLATFORM_ADMIN_WALLETS`, parsing/
   normalizing once at module load.
5. **Local dev:** `sst dev` / `sst shell` already inject secrets; add to local `.env` if running
   the backend outside `sst shell`.

---

## 5. Edge cases, validation, decisions

### Edge cases
- **Admin who is also a real merchant owner/admin:** the real-access check runs *first*, so for
  their own merchants they get full write access; only on *others'* merchants are they read-only.
  No special-casing needed.
- **Audit logging:** log every platform-admin bypass (wallet, merchantId, method, path) at the
  choke point using the existing `log` from `@backend-infrastructure`. Recommend also logging the
  `/admin/lookup` calls. (Decision D3: do we need a durable audit trail vs. structured logs?)
- **Session expiry:** unchanged — business JWT is 7 days; `authStore.isAuthenticated()` enforces
  client-side; backend `verify` rejects expired tokens. Admin status is re-derived each request,
  so it cannot outlive the allow-list.
- **Write attempts (UI bypassed / direct API):** denied with the existing `403 Access denied`
  because the bypass excludes non-safe methods. This is the guarantee, not the UI.
- **Non-GET reads / GET side effects:** the method heuristic assumes RESTful conventions. Grep
  confirmed reads are GET, but this must be re-verified before merge (see residual risks). If any
  read is a POST, it would be denied to admins (fails safe — read blocked, never a write opened).
- **`PUT /merchant/:merchantId` and similar:** correctly denied for admins (non-GET).
- **Allow-list format/typos:** normalize + validate addresses at parse time; ignore invalid
  entries and log a warning rather than throwing (avoid taking down the backend on a bad secret).

### Validation commands / tests
- `cd services/backend && bun run typecheck && bun run lint && bun run test`
- New unit test: `PlatformAdminService` parse/normalize + empty-secret = false.
- New integration test on a merchant route: admin-only wallet → GET `200`, POST/PUT `403`;
  non-admin non-owner → GET `403`.
- `apps/business`: `bun run test` + manual smoke — admin sees banner, controls disabled, lookup
  works, navigating to a foreign merchant loads read-only.
- Infra: `bunx sst diff` on a sandbox stage to confirm the new secret wires into `elysiaEnv`.

### Decisions needing user approval
- **D1 — Identity key:** allow-list keys on **wallet address** (login is SIWE, there is no email
  on the business session). The task mentioned "emails or user ids"; confirm wallet addresses are
  acceptable. (Recommended.)
- **D2 — Merchant selection UX:** add a guarded `/admin/lookup` search endpoint (recommended) vs.
  returning a full merchant list. Confirm search-by-domain/id is the desired UX.
- **D3 — Audit durability:** structured `log` lines (recommended, minimal) vs. a persisted audit
  table.
- **D4 — Scope of read-only views:** confirm which dashboard sections admins may view (all GET
  data incl. bank balances, members PII?) or whether any section must stay hidden.

---

## 6. Non-goals (explicit)
- No email-based or OAuth-based admin identity; no new login flow.
- No per-merchant or granular RBAC redesign; `MerchantAuthorizationService` semantics unchanged.
- No editing/mutation capability for admins on foreign merchants — strictly read-only.
- No "act as / full impersonation" with write powers.
- No admin self-service management of the allow-list (it is a backend secret, ops-controlled).
- No changes to Shopify-session or wallet/SDK auth paths.
- No refactor of existing route handlers beyond the additive `/my` field and new lookup route.

---

## 7. Alternatives considered

| Option | Surface | Risk | Verdict |
|---|---|---|---|
| **A. Method-aware bypass at single choke point** (recommended) | 1 backend fn + secret + UI | Relies on REST GET=read convention (verifiable) | **Chosen** — smallest, DRY, fail-safe (only reads ever opened) |
| B. New `hasMerchantReadAccess` helper; switch every GET route to it | ~20+ route edits | High churn, easy to miss a route, merge conflicts | Rejected — large surface, error-prone |
| C. Grant admins full `hasAccess` + add explicit write-guards per mutation route | ~30+ route edits | Must remember a guard on *every* write; one miss = silent write hole | Rejected — inverts the safe default (dangerous) |
| D. Separate "admin console" app/API surface | New app + routes + auth | Large build; duplicates dashboard | Rejected — over-engineered for a debug/read use case |

Option A is safest because the *default* for writes stays "deny" and the bypass can only ever
widen **read** access; a classification mistake fails closed (blocks a read), never opens a write.

---