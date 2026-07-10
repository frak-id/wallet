# Business Walletless Auth — Shopify SSO + Email/Password with 2FA

> Design document for adding Shopify SSO and email/password authentication to `apps/business`,
> with backend side effects in `services/backend`. Walletless users get access to everything
> except onchain wallet-signed actions (bank withdraw, allowance, open/close).

---

## 1. Current state (as-explored)

### 1.1 Authentication today

Business auth is **SIWE-only, stateless JWT**:

- `apps/business` login (`src/module/login/component/Login/index.tsx`) opens the Frak wallet modal via `useSiweAuthenticate()` → user signs a SIWE message with their passkey-backed smart wallet.
- `POST /business/auth/login` (`services/backend/src/api/business/auth.ts:15-93`) verifies the SIWE signature (`verifyMessage`, ERC-1271/6492 aware) and signs a **business JWT** (`JwtContext.business`, HS256, 7 days, `services/backend/src/infrastructure/external/jwt.ts:34`).
- Token payload: `BusinessTokenDto = { wallet: Address, siwe?: {...} }` (`domain/auth/models/BusinessSessionDto.ts`). **The identity IS the wallet address.**
- Client stores `{ token, wallet, expiresAt }` in Zustand (`apps/business/src/stores/authStore.ts`, localStorage key `business-auth`) and sends it as `x-business-auth` header (`src/api/backendClient.ts`).
- Route guard: `_restricted` layout + `src/middleware/auth.ts` (client-side expiry check; server enforces via 401).
- A parallel **walletless path already exists**: Shopify embedded-app session tokens (`x-shopify-session-token`, verified in `infrastructure/external/shopifyJwt.ts`), which resolve merchant access **by shop domain** (`MerchantAuthorizationService.hasAccessByDomain`). This proves the codebase can partially operate without a wallet.

### 1.2 The onchain / offchain boundary (crucial finding)

The exploration shows the boundary is already much friendlier to walletless users than expected:

**User-wallet-signed (the ONLY things a walletless user cannot do):**

| Action | File | Contract call |
|---|---|---|
| Bank allowance update/revoke | `apps/business/src/module/merchant/hook/useBankAllowanceMutation.ts` | `campaignBank.updateAllowance / revokeAllowance` |
| Bank open/close (budget pause) | `.../useSetBankOpenStatus.ts` | `campaignBank.setOpen(bool)` |
| Bank withdraw | `.../useWithdrawFromBank.ts` | `campaignBank.withdraw(token, amount, to)` |
| Legacy bank migration | `.../useMigrateLegacyBank.ts` | batched legacy withdraw + transfer |

**Backend-executed onchain (derived keys from `MASTER_KEY_SECRET`, `infrastructure/keys/AdminWalletsRepository.ts`) — walletless-compatible:**

- Bank deploy at registration (`bank-manager` key, `CampaignBankRepository.deployBank`)
- Manager role grant/revoke (`/bank/sync`)
- Reward settlement (`rewarder` key → RewardsHub)
- Test-token funding (`minter` key, dev only)

**Pure DB / API — walletless-compatible:**

- Campaign CRUD **and publish/pause/resume/archive** — campaigns are 100% offchain DB rows (`CampaignManagementService`), publish is a status transition, nobody signs anything.
- Merchant "mint" (registration) — a DB row + backend bank deploy. The user's SIWE signature is only an **ownership proof**, not a transaction.
- Stats, members, notifications (push), team admins, webhooks, media, billing.

**Wallet-assumed places that must be generalized:**

- `merchants.owner_wallet` NOT NULL (`domain/merchant/db/schema.ts:28`) + `merchant_admins.wallet`
- `GET /merchant/my` enumerates by wallet (`api/business/merchant/index.ts:125-137`)
- Registration SIWE proof + DNS TXT string embeds the wallet
- Admin add/remove keyed on wallets; ownership transfer wallet→wallet
- Platform admin = env allow-list of wallets (`PlatformAdminService`)
- Bank MANAGER role granted to `ownerWallet` onchain

### 1.3 Reusable infrastructure

- **Resend email client**: `infrastructure/integrations/email/ResendClient.ts` — thin `ky` adapter, `resendClient.send({to, subject, html})`, retry + idempotency. Currently used by the identity domain's 6-digit email verification (`EmailVerificationService`, challenge table `email_verification_codes` with attempts/debounce/TTL — a good pattern to replicate).
- **Shopify env**: `SHOPIFY_API_SECRET`, `SHOPIFY_CLIENT_ID` already present; session-token verify + webhook HMAC validation exist.
- **PostgreSQL via Drizzle** per-domain schemas; migrations are human-written (db team).

---

## 2. Goals & non-goals

### Goals

1. **Email + password** login/register for business users, with mandatory 2FA (email OTP via Resend, or TOTP).
2. **Shopify SSO** — log into the business dashboard with a Shopify store staff account.
3. **Step-up 2FA** on sensitive actions: merchant mint (registration), campaign publish, notification sending, admin management, ownership transfer.
4. **Capability-gated UI/API**: walletless accounts can do everything except the four wallet-signed bank actions.
5. Keep the backend **lean**: no Better Auth, no framework — small audited primitives only.
6. **Wallet linking**: a walletless account can later link a Frak wallet (via SIWE) and unlock bank actions.

### Non-goals

- Replacing wallet-side (user app) WebAuthn auth — untouched.
- Making bank withdraw/allowance/pause possible without a wallet (custody decision, out of scope — see variants §8.3).
- Social logins beyond Shopify.

---

## 3. Recommended library stack (lean philosophy)

| Concern | Choice | Why |
|---|---|---|
| Password hashing | **`Bun.password`** (argon2id, native) | Zero deps, RustCrypto-backed, exceeds OWASP minimums, PHC-portable |
| Session tokens | **Hand-rolled DB sessions** per the Lucia guide | ~80 lines; sha256(token) stored, instant revocation, 2FA state = column |
| Crypto primitives | `@oslojs/crypto`, `@oslojs/encoding` | Tiny, zero-dep, runtime-agnostic, feature-complete; vendorable |
| TOTP | `@oslojs/otp` (+ `uqr` for QR) | RFC-exact HOTP/TOTP, grace-period verify, key-URI builder |
| Shopify OAuth | **`arctic`** (Shopify provider) | Handles token exchange; we add HMAC + shop-domain validation manually (~15 lines) |
| Email OTP | ~50 lines own code + existing `resendClient` | Replicates the proven `email_verification_codes` pattern |

Total new deps: `arctic` + 3 `@oslojs/*` + optional `uqr`. All tiny, auditable, and consistent with "install lib only for high value".

> Lucia is now a *guide*, not a package — we use it as the spec for session management. This is exactly the manual-but-informed approach the team wants.

---

## 4. Architecture

### 4.1 New concept: **Business Account** (identity decoupled from wallet)

Today `identity = wallet`. We introduce a first-class `business_accounts` entity; a wallet becomes **one of several credentials** attached to it.

```
business_accounts (1) ──< business_account_credentials
        │                    ├─ type: "password"        (email + argon2id hash)
        │                    ├─ type: "shopify"          (shopify user id + shop domain)
        │                    └─ type: "wallet"           (SIWE-proven address)
        ├──< business_sessions        (DB-backed, revocable, 2FA state)
        ├──< business_totp            (encrypted secret, activated flag)
        └──< business_email_codes     (email OTP challenges)
```

### 4.2 New domain: `services/backend/src/domain/business-auth/`

Follows the existing DDD layout:

```
src/domain/business-auth/
├── db/schema.ts                    # pgTable (PostgreSQL — NOT libSQL; libSQL is WebAuthn-only)
├── repositories/
│   ├── BusinessAccountRepository.ts
│   ├── BusinessSessionRepository.ts
│   └── BusinessCredentialRepository.ts
├── services/
│   ├── PasswordService.ts          # Bun.password wrapper + policy (zxcvbn-lite optional)
│   ├── BusinessSessionService.ts   # token gen, sha256 storage, sliding expiry, revoke
│   ├── TotpService.ts              # @oslojs/otp; AES-256-GCM secret encryption (key from MASTER_KEY_SECRET derivation, reuse AdminWalletsRepository HKDF pattern)
│   ├── EmailOtpService.ts          # 6-digit CSPRNG, hashed, TTL 10min, attempts, resend debounce — mirror EmailVerificationService
│   └── ShopifySsoService.ts        # arctic Shopify provider, HMAC + shop regex validation, associated_user extraction
├── context.ts                      # BusinessAuthContext.{repositories,services}
└── index.ts
```

Cross-domain flows (account ↔ merchant linking, wallet linking, Shopify shop → merchant matching) go in `src/orchestration/business-auth/` per the flow rules (`api → orchestrator → services|repositories`; never service→service cross-domain).

### 4.3 Database schema (Drizzle, human-migrated — sketch for the db team)

```ts
// domain/business-auth/db/schema.ts (pgTable)

business_accounts:
  id uuid PK, email citext UNIQUE NULL, email_verified_at timestamptz,
  display_name text, created_at, updated_at

business_account_credentials:
  id uuid PK, account_id FK, type enum('password','shopify','wallet'),
  -- password: password_hash (PHC string)
  -- shopify:  shopify_user_id, shop_domain, account_owner bool
  -- wallet:   wallet_address (customHex)
  UNIQUE(type, shopify_user_id, shop_domain), UNIQUE(type, wallet_address)

business_sessions:
  id text PK (= sha256(token) hex), account_id FK,
  created_at, expires_at, last_used_at,
  two_factor_verified_at timestamptz NULL,   -- step-up state
  auth_method enum('password','shopify','siwe'),
  ip inet, user_agent text

business_totp:
  account_id PK/FK, encrypted_secret bytea, activated_at timestamptz NULL,
  recovery_codes_hash text[] -- sha256 of each, consumed → removed

business_email_codes:            -- mirror of identity's email_verification_codes
  account_id, purpose enum('login_2fa','step_up','email_verify'),
  code_hash, attempts int, last_sent_at, expires_at, consumed_at
```

**Merchant schema changes (backward compatible):**

```ts
merchants:
  owner_wallet          -> make NULLABLE
  owner_account_id uuid -> NEW, FK business_accounts, NULLABLE
  CHECK (owner_wallet IS NOT NULL OR owner_account_id IS NOT NULL)

merchant_admins:
  wallet                -> make NULLABLE
  account_id uuid       -> NEW, NULLABLE
  CHECK (wallet IS NOT NULL OR account_id IS NOT NULL)
```

Existing wallet-owned merchants get an **eager backfill** via a `services/bootstrap` migration job (Phase 0, §5); login-time upsert remains as idempotent fallback.

### 4.4 Session strategy: full unification on DB sessions (decided)

**Every** login method (SIWE, password, Shopify SSO) mints the same DB-backed session:
opaque 32-byte token, `sha256` stored in `business_sessions`, sent as `x-business-auth`
header. Sliding 7-day expiry, `two_factor_verified_at` for step-up. The business JWT
(`JwtContext.business`) is retired; the middleware keeps verifying old JWTs during a
grace window (one token lifetime = 7 days) then the code path is deleted.

SIWE login upserts a `business_account` (wallet credential) so the account model is
universal — eager backfill covers existing users (§5, `services/bootstrap`).

The **embedded Shopify path is explicitly NOT unified**: `x-shopify-session-token`
(App Bridge JWT, per-request, minted by Shopify admin) stays a stateless parallel
channel and never creates a `business_session`. See §4.11.

### 4.5 Middleware evolution — `api/business/middleware/session.ts`

The resolved context becomes capability-aware:

```ts
businessSession: {
  accountId: string,
  wallet: Address | null,          // null ⇒ walletless
  authMethod: "siwe" | "password" | "shopify",
  twoFactorVerifiedAt: Date | null,
} | null
shopifySession: {...} | null       // embedded App Bridge token — unchanged, exempt from 2FA
```

New macros (Elysia macro pattern, `infrastructure/macro/`):

```ts
businessAuthenticated()   // any valid session (unchanged behaviour)
requireWallet()           // 403 WALLET_REQUIRED if session.wallet === null
requireStepUp()           // skipped entirely when auth is a shopifySession (embedded);
                          // otherwise 401 + x-frak-auth-error: step-up-required unless
                          // two_factor_verified_at within the freshness window (5 min)
```

**Step-up protocol (error-code + Eden auto-retry).** Following the existing
`x-frak-auth-error` precedent (`infrastructure/macro/authError.ts`, used for the
wallet's auth-expired handling), `requireStepUp` returns:

```
401
x-frak-auth-error: step-up-required
body: { error: "step_up_required", methods: ["totp", "email", "siwe"] }  // methods the account has enabled
```

On the frontend, `apps/business/src/api/backendClient.ts` already intercepts globally
via `onResponse`. Eden treaty can't replay a request from `onResponse`, so we wrap the
treaty's `fetcher` instead:

```ts
// backendClient.ts — custom fetcher
async function stepUpAwareFetch(input, init) {
    const res = await fetch(input, init);
    if (res.status !== 401) return res;
    if (res.headers.get("x-frak-auth-error") !== "step-up-required") return res;
    const ok = await requestStepUp();   // opens the 2FA modal (Zustand-driven),
                                        // resolves true once /auth/2fa/verify succeeds
    if (!ok) return res;
    return fetch(input, init);          // transparent single retry
}
```

The mutation caller never knows step-up happened — same UX as the wallet's session
refresh. One guard: the retry is attempted once, and only for idempotent-safe business
mutations (all our sensitive routes are — publish/send/register are upsert-shaped or
idempotency-keyed).

`hasMerchantAccess(merchantId)` extends `MerchantAuthorizationService` to check
`owner_account_id` / `merchant_admins.account_id` in addition to wallets.

### 4.6 New API surface — `api/business/auth/` (consolidated)

The 2FA surface is **method-generic**: one challenge endpoint, one verify endpoint. The
`method` discriminates; "login 2FA" vs "step-up" is not a separate endpoint — verifying
a challenge always sets `two_factor_verified_at = now()` on the session, which both
completes a pending login *and* refreshes the step-up window. Same logic, one code path.

```
# Login (each mints a business_session; 2FA-pending except SIWE)
POST /business/auth/login                    # SIWE — session immediately 2FA-verified
                                             # (passkey ceremony counts), starts 5-min window
POST /business/auth/register                 # email+password → account + email-verify code
POST /business/auth/login/password           # → pending session (2FA required)
GET  /business/auth/shopify/authorize?shop=  # validate shop regex → 302 to Shopify OAuth
GET  /business/auth/shopify/callback         # state + HMAC → arctic exchange → account upsert
                                             # → pending session (2FA required)

# 2FA — generic across methods ("email" | "totp" | "siwe")
POST /business/auth/2fa/challenge  { method }        # email: send OTP via resendClient
                                                     # totp: no-op (client has the app)
                                                     # siwe: returns a nonce/message to sign
POST /business/auth/2fa/verify     { method, proof } # email/totp: proof = code
                                                     # siwe: proof = { message, signature }
                                                     # → sets two_factor_verified_at (login
                                                     #   completion AND step-up refresh)
POST /business/auth/2fa/setup      { method }        # enroll: totp → otpauth:// URI + QR;
                                                     # email → sends confirm code (step-up req.)
POST /business/auth/2fa/activate   { method, proof } # confirm enrollment (totp code / email code)

# Session management
POST   /business/auth/logout                 # revoke current session
GET    /business/auth/sessions               # list active sessions
DELETE /business/auth/sessions/:id           # revoke (logout-everywhere)

# Credential linking (step-up required)
POST /business/auth/link/wallet              # SIWE proof → attach wallet credential
POST /business/auth/link/password            # add email+password to a Shopify/SIWE account
```

12 routes total (down from ~16 in the first draft); the four `2fa/*` routes replace the
seven method-specific ones. `siwe` as a 2FA method is what lets wallet users satisfy
step-up with a fresh signature instead of enrolling TOTP/email (§4.8).

**Password endpoints hardening**: token-bucket rate limit (existing `infrastructure/rateLimit`), constant-time email lookup behaviour (hash a dummy on unknown email), generic error messages, argon2id via `Bun.password`.

**Email OTP policy** (per research + existing `EmailVerificationService` precedent): 6 digits, hashed at rest, 10-min TTL, single-use, max 5 attempts, ≥60s resend debounce, ~5 sends/hour.

### 4.7 Shopify SSO flow detail

The correct flow for "log into an external dashboard with your Shopify account" is the
**OAuth authorization-code flow with online tokens** (`grant_options[]=per-user`) —
*not* App Bridge session tokens (embedded only) and *not* Sign in with Shop (buyer identity).

```
Login page: [shop-domain input] → GET /auth/shopify/authorize?shop=my-store.myshopify.com
  1. Validate shop domain regex: /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/
  2. arctic.Shopify(shop, SHOPIFY_CLIENT_ID, SHOPIFY_API_SECRET, callbackUrl)
     → createAuthorizationURL(state, scopes) + grant_options[]=per-user
  3. Store state in short-lived HttpOnly cookie
Callback:
  4. Verify state; verify query HMAC (sort params, HMAC-SHA256 with app secret,
     timing-safe compare) — arctic does NOT do this, ~15 lines manual
  5. Exchange code → online token + associated_user { id, email, account_owner }
  6. Upsert business_account + shopify credential (shopify_user_id + shop_domain)
  7. Merchant auto-link: match shop_domain against merchants.domain/allowedDomains
     (reuse hasAccessByDomain logic) — Shopify SSO users get access to matching merchants
  8. Create business_session (2FA pending) → redirect to /login/2fa
```

Notes:

- Requires the merchant to have the Frak Shopify app installed once — aligned with the existing `apps/shopify` embedded app; **reuse the same Shopify app** (`SHOPIFY_CLIENT_ID/SECRET` already in env, `global.d.ts:15-17`).
- **Scopes: confirmed fine.** Checked `apps/shopify/shopify.app.production.toml` — online
  (per-user) tokens are requested via `grant_options[]=per-user` at authorize time, not a
  toml scope; the current scope list needs no change for identity. **One required config
  change**: add the backend callback (e.g. `https://backend.frak.id/business/auth/shopify/callback`)
  to `[auth] redirect_urls` in both toml files — today only `extension-shop.frak.id` URLs
  are registered.
- We only need the **identity** from the online token (`associated_user`); we don't need to store the access token unless we later want API calls on behalf of the user.
- The existing `x-shopify-session-token` embedded path stays untouched (it serves `apps/shopify` inside the Shopify admin). The two paths converge on the same `business_account` when `shopify_user_id` matches.

### 4.11 Embedded Shopify app users — explicitly exempt from 2FA

The embedded app (`apps/shopify`) must not get more friction. Rationale for the exemption:

- Embedded users **never hold a `business_session`** — every backend call carries a fresh
  App Bridge JWT (`x-shopify-session-token`, ~60s expiry, minted by Shopify admin itself,
  HMAC-verified with the app secret in `shopifyJwt.ts`). The user is *inside* Shopify
  admin, already authenticated by Shopify — Shopify enforces its own staff 2FA. Adding
  ours would be double-2FA with zero security gain.
- `requireStepUp()` therefore short-circuits: if the resolved auth is a `shopifySession`,
  the guard passes. Merchant scoping stays domain-bound (`hasAccessByDomain`) exactly as
  today, so a stolen embedded token still only reaches that shop's merchant.
- **Mint from embedded**: fully **inline** — see §4.12. The popup flow is deleted.
- **Campaign create/publish from embedded**: goes through `x-shopify-session-token` +
  `hasMerchantAccess(domain)` — no step-up, no change.

Net effect: embedded UX gets *simpler* (popup removed); 2FA only exists for standalone
dashboard sessions.

### 4.12 Inline embedded mint — delete the popup, the setup code, and `/embedded/*`

Today's embedded mint chain: Frak wallet login inside Shopify admin → `api.mint.tsx`
generates a `setupCode` (`keccak256(domain + wallet + salt)`, `services.server/mint.ts`)
→ popup to `business.frak.id/embedded/mint?sc=…` → popup SIWE auth
(`apps/business/src/routes/embedded/auth.tsx`) → SIWE registration statement → popup
closes → Shopify app polls popup-close + merchant-refresh with retries
(`components/Stepper/Step1.tsx:130-186`). Three auth ceremonies and ~150 lines of
popup/poll plumbing.

**The popup only exists because registration needed a wallet signature**, and the wallet
lives on `business.frak.id`'s origin. With `owner_account_id`, that constraint is gone.
The App Bridge token already proves shop domain (`dest`) + staff identity (`sub`) —
everything the `setupCode` + SIWE combo proved, minus the wallet.

**New flow — one API call from the embedded app:**

```
Step1 "Connect" button → POST /business/merchant/register
                          headers: { x-shopify-session-token }
                          body: { name, currency }        # domain comes from the token
```

Backend (`MerchantRegistrationService`, shopify-session branch):
1. Domain = normalized `dest` from the verified token; `allowedDomains` gets the
   `myshopify.com` domain when the primary differs (what the `sd` param did).
2. Domain proof = the token itself (same rule as §4.10 SSO bypass) — no DNS TXT,
   no setup code.
3. Upsert a `business_account` with a **shopify credential** from the token's
   `sub` + shop domain → becomes `owner_account_id`. Key convergence: when that staff
   member later hits the standalone dashboard via Shopify SSO (§4.7), the OAuth
   `associated_user.id` matches the same credential — **they land on an account that
   already owns the merchant**. No linking step.
4. `owner_wallet = NULL`; bank deploys as usual (backend key); manager-role grant
   skipped until a wallet is linked from the dashboard (then `/bank/sync`).
5. Step-up: exempt (shopifySession, §4.11).

**Deletions:**

| What | Where |
|---|---|
| `/embedded/*` routes + module (auth, layout, mint) | `apps/business/src/routes/embedded/`, `src/module/embedded/` |
| Popup open/poll/retry machinery + mint-URL prefetch | `apps/shopify/app/components/Stepper/Step1.tsx` |
| Setup-code endpoint + generation | `apps/shopify/app/routes/api.mint.tsx`, `services.server/mint.ts`, `PRODUCT_SETUP_CODE_SALT` env |
| `setupCode` bypass param in registration | `MerchantRegistrationService.ts` (after a deprecation window) |
| Wallet-login prerequisite for onboarding Step1 | Shopify stepper — wallet connect becomes optional, needed only for bank actions (`useBankActions.ts`, unchanged wallet-gated) |

Step1 becomes: click → mutation → revalidate loader. No popup, no polling, no wallet.
The replacement for the popup-close polling is a plain `fetcher` + loader revalidation —
the merchant appears in the same response cycle.

**Edge cases:**
- **Domain already registered / race between two shop admins**: the backend already
  throws 409 on duplicate domain (`MerchantRegistrationService.ts:72`); the only true
  race window is between the existence check and the insert — close it with a UNIQUE
  violation catch on `merchants.domain` (the column is already unique) mapped to the
  same 409. Client recovery is trivial because it already exists: on 409, call
  `resolveMerchantId(domain)` (`apps/shopify/app/services.server/merchant.ts:64` —
  backend `user.merchant.resolve` by domain, LRU-cached, persists the merchantId shop
  metafield) and render Step1 as connected. Loser of the race and re-installs converge
  on the same path; no error surfaced to the user.
- **Staff member vs owner (decided)**: permissive — any staff with admin-app access can
  register, same trust level as `hasAccessByDomain`.
- Existing wallet-minted Shopify merchants: untouched (`owner_wallet` set); the shopify
  credential of whoever registered simply isn't the owner account — domain-based access
  keeps working as today.

### 4.8 2FA requirement matrix — one freshness rule for everyone

**Single invariant**: a sensitive action requires `two_factor_verified_at` within the
last **5 minutes**, whatever the method that set it. There is no per-method logic in the
guard — only in how the timestamp gets refreshed:

| Auth method | At login | Step-up refresh |
|---|---|---|
| SIWE | Passkey ceremony counts — `two_factor_verified_at = now()` at login | Fresh SIWE re-sign (`2fa/verify {method:"siwe"}` — the Frak modal opens, user re-signs) |
| Password | Mandatory: session unusable until email OTP or TOTP verified | Email OTP or TOTP |
| Shopify SSO | Mandatory: email OTP or TOTP after callback | Email OTP or TOTP |
| Shopify **embedded** (`x-shopify-session-token`) | **Exempt** — never 2FA (§4.11) | **Exempt** |

So a wallet user who logs in and publishes a campaign within 5 minutes sees nothing; past
5 minutes, the Eden fetch wrapper transparently opens the Frak modal for a re-sign and
retries. Password/Shopify users get the OTP/TOTP modal instead. Accounts may enroll
**both** email and TOTP — the step-up modal lets them pick (methods list comes from the
401 body).

**Step-up on sensitive actions**, enforced by `requireStepUp()`:

| Action | Route | Step-up |
|---|---|---|
| Merchant registration ("mint") | `POST /business/merchant/register` | ✅ |
| Campaign publish | `POST .../campaigns/:id/publish` | ✅ |
| Notification send/schedule/broadcast | `POST /business/notifications/*` | ✅ |
| Admin add/remove | `POST/DELETE .../admins` | ✅ |
| Ownership transfer | `.../transfer` | ✅ |
| Credential changes (password, TOTP, wallet link) | `/business/auth/link/*`, 2fa setup | ✅ |
| Campaign pause/resume/archive/draft CRUD | — | ❌ (low risk) |
| Stats, members read, media | — | ❌ |

All rows marked ✅ are skipped when the caller is an embedded `shopifySession` (§4.11).

### 4.9 Capability gating (frontend)

Extend `authStore` and expose a single derived hook:

```ts
// apps/business/src/stores/authStore.ts
{ token, wallet: Address | null, accountId, authMethod, expiresAt }

// apps/business/src/module/common/hook/useCapabilities.ts
const { canOnchain } = useCapabilities();   // = wallet !== null
```

UI changes (all in `src/module/merchant/component/ManageBudgetSheet/`):

- `TokenCard` (allowance/withdraw), `BudgetView` (open/close), `LegacyBankMigration`:
  when `!canOnchain`, render disabled state with a "Link a Frak wallet to manage funds"
  CTA → wallet-link flow (opens Frak SDK modal → SIWE → `POST /auth/link/wallet`).
- Everything else (campaigns wizard, publish, stats, members, push, settings) unchanged.

Backend defense-in-depth: there are no backend routes for withdraw/allowance/setOpen (they
are pure frontend txs), but `/:merchantId/bank/sync` and role-grant paths must no-op
gracefully when the owner has no wallet (skip `grantManagerRole`, return
`managerRole: "no_wallet"` in bank status instead of reading `rolesOf(ownerWallet)`).

### 4.10 Registration without a wallet & Shopify domain verification

`MerchantRegistrationService.register()` currently demands a SIWE proof. Generalized:

- **Wallet path (unchanged)**: SIWE statement proof → `owner_wallet` + `owner_account_id`.
- **Walletless path**: step-up-verified session is the ownership proof; DNS TXT string binds
  to `accountId` instead of the wallet (`frak-verification=<hash(domain + accountId)>`).
  `owner_wallet = NULL`, bank still deploys (backend `bank-manager` key), **manager role
  grant is skipped** until a wallet is linked (then `/bank/sync` grants it).
- **Shopify path (decided)**: if the SSO session's `shop_domain` equals the registering
  domain, **or the registering domain is a subdomain of it** (and vice-versa for the
  storefront primary domain vs `myshopify.com` domain — match against both, like
  `hasAccessByDomain` does with `merchant.domain`/`allowedDomains`), the DNS TXT check is
  skipped entirely. UI shows an info banner: *"Domain verified thanks to your Shopify
  session"*. Implementation-wise this is a third bypass next to the existing `setupCode`
  bypass in `MerchantRegistrationService.register()` (`MerchantRegistrationService.ts:82-87`).
  Subdomain matching: suffix match on dot boundary (`shop.example.com` matches
  `example.com`), never bare TLD suffixes.

---

## 5. Implementation plan (phased)

### Phase 0 — Eager migration (`services/bootstrap`)
One-shot migration job (runs before backend deploy, per the existing bootstrap pattern):
- Create a `business_account` + `wallet` credential for **every distinct wallet** seen in
  `merchants.owner_wallet` and `merchant_admins.wallet` — *plus* wallets that have logged
  into the business dashboard but own no merchant yet (source: distinct wallets from any
  available signal; if none is persisted today, these users are covered by login-time
  upsert as a safety net — the upsert stays as idempotent fallback regardless).
- Backfill `merchants.owner_account_id` and `merchant_admins.account_id`.
- End state invariant: every merchant row has `owner_account_id NOT NULL` (wallet columns
  stay for onchain role management, and nullable for future walletless rows).

### Phase 1 — Account model + unified sessions + email/password + email OTP
- `business-auth` domain: schema (hand off to db team), repositories, `PasswordService`, `BusinessSessionService`, `EmailOtpService`.
- **Full session unification**: SIWE login mints a DB session (JWT verify kept 7 days as grace path, then removed).
- Auth routes (register/login, generic `2fa/challenge|verify|setup|activate`, logout, sessions), middleware resolution, `requireStepUp` + `requireWallet` macros, `x-frak-auth-error: step-up-required` protocol.
- Frontend: login page tabs (Wallet | Email | Shopify), register flow, 2FA modal, `stepUpAwareFetch` wrapper in `backendClient.ts`.
- Rate limiting on all auth endpoints.

### Phase 2 — Walletless capability gating
- `hasMerchantAccess` account-aware; walletless merchant registration (DNS TXT bound to accountId, skip role grant).
- Bank status/sync tolerant of `owner_wallet = NULL`.
- Frontend `useCapabilities()`, disabled bank UI + wallet-link CTA, `POST /auth/link/wallet`.
- Apply `requireStepUp` to the sensitive-action matrix (§4.8), including the embedded-session exemption.

### Phase 3 — Shopify SSO + inline embedded mint
- `ShopifySsoService` (arctic + HMAC + shop validation), authorize/callback routes, `associated_user` → account upsert, shop-domain → merchant auto-link.
- Shopify-domain DNS-check bypass (+ "Domain verified thanks to your Shopify session" UI).
- Register the backend callback in the Shopify app toml `redirect_urls`.
- Frontend Shopify login entry (shop-domain input / "Continue with Shopify").
- **Inline embedded mint (§4.12)**: shopify-session registration branch in `MerchantRegistrationService`; delete `apps/business` `/embedded/*` routes + module, the Shopify popup/poll machinery, `api.mint.tsx` and setup-code generation; drop the wallet prerequisite from onboarding Step1.

### Phase 4 — TOTP + polish
- `TotpService` (encrypted secrets, recovery codes), setup/activate via the generic `2fa/setup|activate` routes, QR via `uqr`, settings "Security" section (enroll email and/or TOTP — both can coexist, §4.8), session management UI (list/revoke).
- Email change / reset-password flows.
- Remove the legacy business-JWT grace path.

Testing: Vitest per service (backend-unit project, Node env); mock `resendClient`; e2e of the 2FA + step-up loop in `apps/business` tests.

---

## 6. Security considerations

- **Password storage**: argon2id via `Bun.password` defaults (64 MiB, t=2) — above OWASP minimums.
- **Session tokens**: 32 random bytes, only sha256 stored; header-based (existing pattern) so CSRF surface is minimal, but keep Origin validation (already done for SIWE) on state-changing auth endpoints.
- **TOTP secrets** encrypted at rest (AES-256-GCM, key derived from `MASTER_KEY_SECRET` via the existing HKDF/HMAC derivation pattern in `AdminWalletsRepository`).
- **Email OTP** hashed at rest, strict attempt/send limits (mirror `email_verification_codes` design); sent from a **dedicated security sender** (e.g. `security@frak-labs.com`, new `RESEND_SECURITY_FROM_EMAIL` env) — not the generic noreply.
- **Enumeration resistance**: identical responses/timing for unknown emails on login, register ("if an account exists you'll receive an email"), and OTP endpoints.
- **Shopify callback**: state cookie + HMAC query validation + strict shop-domain regex; never trust `shop` from query without validation (SSRF/phishing vector).
- **Recovery codes**: 8×10-char codes, sha256-stored, single-use — mandatory at TOTP activation; for email-OTP-only accounts, the email itself is recovery.
- **Step-up window**: 5 minutes; every sensitive mutation re-checks server-side (never trust the client's modal state).
- **Walletless ≠ weaker merchant auth**: registration still requires domain proof (DNS TXT or Shopify domain match).

---

## 7. Decisions (formerly open questions)

1. **Shopify app scopes** — ✅ verified fine (`shopify.app.production.toml`); only change needed is adding the backend callback to `[auth] redirect_urls`.
2. **SIWE step-up** — ✅ yes: a fresh SIWE re-sign is a first-class 2FA method (`2fa/verify {method:"siwe"}`), sharing the exact same 5-minute freshness window as OTP/TOTP. Backend emits `x-frak-auth-error: step-up-required` on stale sessions; the Eden fetch wrapper opens the relevant modal (Frak re-sign for wallet users, OTP/TOTP for others) and auto-retries — mirroring the wallet app's auth-expired handling.
3. **Platform admins** — wallet allow-list (`PLATFORM_ADMIN_WALLETS`) **plus** any account with a *verified* `@frak-labs.com` email (`email_verified_at NOT NULL` and domain check in `PlatformAdminService`). Email verification is the trust gate — an unverified email claim grants nothing.
4. **OTP sender** — dedicated security address (`RESEND_SECURITY_FROM_EMAIL`).
5. **Ownership transfer to walletless accounts** — allowed; onchain `transferBankRoles` is skipped when the target has no wallet, and `/bank/sync` grants the role later if they link one.
6. **Migration** — eager, via a `services/bootstrap` job (Phase 0), including dashboard users without merchants; login-time upsert kept as idempotent fallback.
7. **Sessions** — full unification immediately (no dual-track), 7-day JWT grace path only.
8. **2FA channels** — TOTP and email are peers, chosen at account setup; an account can enroll both and pick at verify time.

---

## 8. Variants considered

### 8.1 Migration strategy: lazy vs eager account backfill
- **Eager (chosen)**: one-shot `services/bootstrap` job creating accounts for every `owner_wallet` / `merchant_admins.wallet` (+ merchantless dashboard users). Clean invariants from day one; bootstrap is exactly the place for pre-deploy complex migrations.
- **Lazy**: create on next login — kept only as the idempotent fallback inside SIWE login.

### 8.2 Session strategy: dual-track vs full unification
- **Full unification (chosen)**: every login method mints a DB session. Uniform revocation, session listing, and step-up; one code path long-term. Legacy business JWTs honored for one 7-day grace window. The embedded Shopify token channel remains separate by design (§4.11).
- **Dual-track**: less initial work, two systems forever — rejected.
- **Stateless-only (rejected)**: JWT with `2fa` claim — no revocation, step-up requires re-issuing tokens, contradicts the research recommendation for a dashboard.

### 8.3 Walletless onchain actions: gate vs delegate vs custody
- **Gate (chosen)**: walletless users simply can't withdraw/pause/allowance until they link a wallet. Honest, zero custody risk, matches the product brief.
- **Delegate**: backend `bank-manager` key executes withdraw/setOpen on behalf of walletless owners (it already holds admin power on banks). Technically trivial but turns Frak into a custodian of merchant funds — legal/security implications; explicitly out of scope, revisit only with strong product pull.
- **Progressive custody**: backend-managed wallet auto-created per account (ERC-4337, like the user side) — elegant long-term ("everyone has a wallet, some don't know it") but a much larger project; the account model in §4.1 keeps this door open (`wallet` credential type).

### 8.4 Auth stack: manual+Oslo vs Better Auth vs others
- **Manual + Oslo/Arctic (chosen)**: 4 tiny deps, full control, follows Lucia-as-a-guide. Fits the "lean backend" doctrine.
- **Better Auth (rejected by requirement)**: bloated, Vercel-acquired, plugin architecture drags in far more than needed, and its Elysia integration would fight the existing macro/JWT patterns.
- **Auth.js / Passport**: Node/framework-centric, poor Elysia fit, session model conflicts.
- **Hosted (Clerk/WorkOS)**: external dependency + cost + data residency; overkill for one dashboard.

### 8.5 Shopify SSO mechanism
- **OAuth online tokens via existing app (chosen)**: real staff identity (`associated_user`), reuses existing app credentials, works outside the Shopify admin.
- **App Bridge session tokens**: only works embedded in Shopify admin — already covered by `apps/shopify`; not SSO for the standalone dashboard.
- **Sign in with Shop**: buyer/customer identity — wrong audience.

### 8.6 2FA channel priority
- **Email + TOTP as peers (chosen)**: the user picks channel(s) at account setup; both can be enrolled on one account, and the step-up modal offers whichever are active (401 body lists them). Ships together in Phase 1 (email) + Phase 4 (TOTP).
- **WebAuthn as 2FA**: ironic given the stack, and elegant — a passkey as second factor for email accounts. Deferred (the libSQL authenticators table is wallet-coupled); worth a later look since `WebAuthNService` exists.

---

## 9. Impact summary

| Area | Change size |
|---|---|
| `services/backend/src/domain/business-auth/` | **New domain** (~6 services, 3 repos, 1 schema) |
| `services/backend/src/api/business/auth/` | ~12 new routes |
| `services/backend/src/api/business/middleware/session.ts` | Session resolution rework + 2 new macros |
| `services/backend/src/domain/merchant/` | Nullable wallet, account-aware authorization, walletless registration |
| `services/backend/src/orchestration/business-auth/` | New orchestrators (linking, Shopify→merchant match) |
| DB migrations (db team) | 5 new tables, 4 altered columns |
| `apps/business/src/module/login/` | Multi-method login + 2FA screens |
| `apps/business/src/stores/authStore.ts` | Account-shaped session |
| `apps/business/src/module/merchant/` (bank UI) | Capability gating + wallet-link CTA |
| `apps/business/src/api/backendClient.ts` | `stepUpAwareFetch` wrapper (2FA modal + auto-retry) |
| `apps/business/src/routes/embedded/` + `src/module/embedded/` | **Deleted** (inline embedded mint, §4.12) |
| `apps/shopify` (Step1, api.mint, mint service) | Popup/poll + setup code deleted; inline register call |
| `services/bootstrap/` | Eager account-backfill migration job |
| `apps/shopify/shopify.app.*.toml` | Add backend callback to `redirect_urls` |
| Shared | 2FA modal (Zustand-driven), `useCapabilities()` |
| New deps | `arctic`, `@oslojs/{crypto,encoding,otp}`, `uqr` |
