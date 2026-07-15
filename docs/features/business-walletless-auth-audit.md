# Audit — Business Walletless Auth (`feat/business-walletless-auth`)

> Consolidated audit of the full feature branch (8 commits, `c5a375735..HEAD`, 148 files,
> +11,197/−4,028) against the design contract `docs/features/business-walletless-auth.md`.
> Three independent read-only review passes: (1) simplification/deduplication,
> (2) coding standards + security correctness, (3) plan adherence.
> Reviewed at `d25c535b8`. Earlier intermediate review rounds (whose findings were fixed in
> `624e72cb0` and `d25c535b8`) are noted where relevant; this document reflects the final state.

---

## 1. Verdict

**The branch honors the (amended) design contract with high fidelity.** All four
findings of the intermediate adherence review (step-up header protocol on link/setup
routes, Shopify SSO merchant auto-link, LegacyBankMigration gating, walletless ownership
transfer) are genuinely implemented, with tests. All prior security fixes
(shopDomainMatch direction, register timing equalization, constant-time compares,
OTP hourly cap) verified correct and consistently applied after the 5→3 schema collapse.

**Blocking before production**: A1 (rate limiting on registration routes).
**Should fix before merge**: A2, A3 (TOTP replay, recovery-code atomicity).
Everything else is hygiene/backlog.

| Review axis | Outcome |
|---|---|
| Simplification / dedup | No blockers; residual duplication concentrated in the step-up guard trio and `twoFactor.ts` internals (S1, S2); dead-code list (S3) |
| Standards & security | 1 high (rate limit), 2 medium (TOTP replay, recovery-code TOCTOU), 4 low; all conventions (DDD flow rules, DI, vanilla-extract, Zustand selectors, Eden treaty, i18n parity) compliant |
| Plan adherence | All doc sections conform; 2 unimplemented commitments (password reset flow, session IP capture); 6 doc-staleness items to fix in the design doc |

---

## 2. Action items — security & correctness

### A1 · HIGH — No rate limiting on merchant registration routes
`services/backend/src/api/business/merchant/registration.ts` — `POST /register`,
`GET /dns-txt`, `GET /verify` have no `rateLimitMiddleware`, unlike **every other**
auth-adjacent surface added by this branch. `/register` triggers a real bank deployment
and is reachable via the step-up-exempt embedded `x-shopify-session-token` branch;
`/verify` doubles as a domain-registration oracle.
**Fix**: IP-keyed limiter with a low ceiling on `merchantRegistrationRoutes`.

### A2 · MEDIUM — TOTP codes have no anti-replay tracking
`domain/business-auth/services/TotpService.ts:172-197` — `verifyTOTPWithGracePeriod`
checks validity only; a captured code is accepted unbounded times within its ~90s window
(e.g. completes a login 2FA *and* a subsequent step-up).
**Fix**: persist a `totp_last_used_at` (or consumed-counter) value on the account row;
reject codes whose counter interval was already accepted.

### A3 · MEDIUM — Recovery-code consumption is not atomic
`TotpService.verify` + `BusinessAccountRepository.consumeTotpRecoveryCode` — check
(`.some(...)` on a fetched snapshot) and consume (`array_remove` UPDATE) are two
round-trips; concurrent requests can double-spend a single-use recovery code.
**Fix**: single conditional UPDATE —
`SET arr = array_remove(arr, hash) WHERE id = $1 AND hash = ANY(arr) RETURNING id` —
and derive the verify result from the returned row. (The email-OTP verify/consume pair
has the same TOCTOU shape; lower impact, mirrors the pre-existing identity-domain
pattern — fix opportunistically.)

### A4 · LOW — Upsert race-recovery catches all errors as "race"
`BusinessAccountService.upsertWalletAccount` (:26-45) / `upsertShopifyAccount` (:66-95)
treat **any** UPDATE failure as a lost race and return the pre-existing row; `linkWallet`
in the same file correctly guards with `isUniqueViolation` and rethrows the rest.
**Fix**: apply the same guard to both upserts.

### A5 · LOW — No cleanup cron for expired auth rows
`BusinessSessionRepository.deleteExpired()` / `BusinessEmailCodeRepository.deleteExpired()`
exist but no job registers them (identity domain has `jobs/emailVerificationCode.ts`
precedent). Not exploitable (expiry re-checked on read) but rows accumulate forever.
**Fix**: register a cleanup cron, or delete the methods deliberately.

### A6 · LOW — Macros re-resolve auth already computed by `.resolve()`
`api/business/middleware/session.ts:170-260` — `businessAuthenticated`, `requireStepUp`,
`platformAdminAuthenticated` each call `resolveBusinessAuth()` from raw headers again;
a guarded route fetches the DB session twice (and may double-fire the sliding-expiry
touch). Correctness is unaffected (duplicated, not diverged).
**Fix**: thread the resolved `businessSession` through, after confirming Elysia
resolve→macro ordering guarantees.

### A7 · LOW — Non-constant-time setupCode compare (pre-existing)
`infrastructure/dns/DnsCheckRepository.ts:71` — `BigInt(hash) === BigInt(setupCode)`.
Pre-existing logic on the deprecation-path setupCode bypass; not a regression of this
branch. Fix opportunistically or let it die with the deprecation window.

### Verified correct (no action)
`matchesShopDomain` one-way direction at **all 5 call sites** (registration bypass,
authorization service ×2, `/merchant/my`, middleware) · register endpoint equal-work on
both branches · constant-time compares on OTP/recovery/HMAC/state · OTP debounce +
hourly window across the row lifecycle · step-up 401 protocol identical from macro and
route helpers (`StepUpRequiredError`, CORS-exposed header), frontend preserves the
session on step-up 401s · fresh 32-byte token per login, sha256-only storage,
pending-2FA isolation, revocation scoped to owning account, sliding-expiry touch
threshold · SIWE 2FA nonce single-use (cleared in the same UPDATE) · SSO state cookie
HttpOnly/Secure/Lax/10-min, all redirects derived from `BUSINESS_URL` only, token in URL
hash not query · no tokens/codes/secrets in any log or error body · legacy JWT grace
path grants zero new capabilities (cannot satisfy step-up, no accountId paths) ·
platform-admin `@frak-labs.com` rule requires `email_verified_at` · en/fr i18n parity
exact (programmatic check) · DDD flow rules, constructor DI, Context singletons,
Drizzle-only, no committed migrations, vanilla-extract, individual Zustand selectors,
Eden treaty everywhere.

---

## 3. Simplification & deduplication (ranked)

Previous rounds already consolidated: SIWE verify core (`utils/siwe.ts`), TOTP key
derivation (`AdminWalletsRepository.deriveKeyBytes`), Eden unwrap/error helpers,
step-up error shape (`utils/stepUpRequired.ts`), dead `requireWallet` macro, 5→3 table
collapse. All verified cleanly applied. Remaining:

| # | Finding | Value / risk |
|---|---|---|
| S1 | **Step-up freshness check triplicated** — `link.ts:150` `requireFreshStepUp`, `twoFactor.ts:331` `requireStepUpUnlessBootstrap`, macro body `session.ts:240`. Error shape was unified; the check wasn't. Extract `assertStepUpFresh(auth, {allowBootstrap?})` | High / low |
| S2 | **Email-OTP send-or-throttle block ×2** inside `twoFactor.ts` (:36-60 challenge, :160-183 setup) — identical 22 lines modulo purpose. Extract local `sendEmailOtpOrThrow` | High / minimal |
| S3 | **Dead code**: `TotpService.isActivated`, `BusinessAccountRepository.clearTotp` (no disable-TOTP route), both `deleteExpired` (see A5), `isLegacyJwt` field written-never-read, `ShopifyAssociatedUser.accountOwner` computed-never-consumed, `business_sessions.ip` never populated (see plan gap P2), `STEP_UP_ERROR_CODE` re-export, most of the domain barrel exports | High / zero |
| S4 | **Post-collapse pass-throughs**: `BusinessAccountService.getPasswordAccountByEmail` (pure delegate, misleading name), `getWallet` (forces a second account fetch in the siwe 2FA path). Delete, call the repo | Medium / low |
| S5 | **`TwoFactorMethod` type + TypeBox union declared 5×** backend-side. One shared DTO (`typeof TwoFactorMethodDto.static`), also removes the frontend cast on `GET /sessions.authMethod` | Medium / low |
| S6 | **Crypto micro-patterns at rule-of-three**: `sha256→hex` ×3, length-guarded constant-time string compare ×4. Two helpers in `@backend-utils` | Medium / low |
| S7 | `extractAuthErrorMessage` lives in `useTwoFactorChallenge.ts` but is imported by 6 unrelated modules — move to a neutral location | Low / zero |
| S8 | Password min-length literal `10` in 4 places (2 backend messages, 2 frontend) — interpolate `PasswordService.MIN_LENGTH` backend-side | Low / low |

**Assessed and deliberately kept**: `EmailOtpService` vs identity's
`EmailVerificationService` (rule-of-three not met; merging would need a cross-domain
import the flow rules forbid — revisit at a third OTP flow) · upsert-race skeleton ×2
(shapes differ enough that a generic helper obscures) · `TwoFactorModal` code input vs
`TotpEnrollment` (2 call sites, different mutations — extract at the third) ·
front/back shop-domain regex mirror (documented; sharing costs a package coupling) ·
`authStore`/`twoFactorStore` split (persisted identity vs ephemeral challenge — correct).

---

## 4. Plan adherence

### Section verdicts

| Doc section | Verdict |
|---|---|
| §4.1–4.3 account model & schema (3-table, amended) | ✅ exact — incl. partial unique indexes, merchant CHECK constraints |
| §4.4 session unification | ✅ — all 3 methods mint DB sessions; zero `JwtContext.business.sign` calls remain; 7-day grace path marked for Phase-4 removal |
| §4.5 middleware & step-up protocol | ✅ — exact header/body/5-min window; `stepUpAwareFetch` single retry |
| §4.6 API surface | ✅ — all 14 listed routes exist, nothing extra |
| §4.7 Shopify SSO | ✅ — full flow; auto-link on 3 surfaces |
| §4.8 2FA matrix | ✅ — exact route set; pause/resume/archive correctly NOT gated |
| §4.9 capability gating | ✅ — all three bank surfaces + `LinkWalletNotice` CTA + backend `managerRole: "no_wallet"` |
| §4.10 walletless registration | ✅ — DNS TXT by accountId, role-grant skip, Shopify bypass |
| §4.11 embedded exemption | ✅ — embedded tokens never mint sessions, step-up short-circuits |
| §4.12 inline mint | ✅ — all promised deletions verified on disk; 409 race handled both sides |
| §5 phases 0–4 | ✅ except P1 below |
| §6 security bullets | ✅ except infra provisioning (P3) |
| §7 decisions 1–8 | ✅ all honored |
| §9 impact table | ⚠️ two stale rows (see doc-fix list) |

### P — Gaps (unimplemented commitments)

- **P1 — Password reset / email change flows** (§5 Phase 4): nothing exists. A
  password-only account with a forgotten password has **no recovery path**. Needs a
  `forgot-password` email flow (the `business_email_codes` machinery is 90% of it) —
  recommend before GA of email login.
- **P2 — `business_sessions.ip` never populated**: column + repo param exist, no route
  passes it; the sessions UI can't show IPs. Either capture it (from the request) or
  drop the column before the db team writes migrations.
- **P3 — Infra provisioning**: `RESEND_SECURITY_FROM_EMAIL` is not in
  `infra/gcp/secrets.ts` — code silently falls back to `noreply@`, defeating §7.4 until
  wired. `BUSINESS_URL` same (acknowledged in `global.d.ts`). Must land with deploy.

### D — Justified divergences (documented in code)

1. `requireWallet` macro dropped — no backend route needs it (bank actions are pure
   frontend txs); NOTE in `session.ts`.
2. arctic has **no** Shopify provider — built on arctic's generic `OAuth2Client` + raw
   token POST (needed for `associated_user`).
3. Embedded mint `primaryDomain` honored only when it `matchesShopDomain` the token's
   shop — custom storefront domains now onboard under the myshopify domain (deliberate
   anti-claim hardening; behavior change vs the old popup flow).
4. `2fa/setup` bootstrap exemption from step-up (zero enrolled methods can't step up).
5. `DELETE /transfer` (cancel) not step-up-gated — de-escalating action, low risk
   (was silent; now recorded here).
6. Cross-domain composition at the API/BFF layer instead of the doc's
   `orchestration/business-auth/` directory — functionally equivalent to the flow rules.

### Beyond-doc additions (consistent with intent)

SIWE 2FA per-session nonce anti-replay · SSO token in URL hash (log/Referer safety) ·
step-up on broadcast *edit* · `platformAdminAuthenticated` macro · email-2FA success
auto-stamps `email_verified_at` · authStore persist-migration for pre-account sessions ·
`two_factor_nonce` / `send_window_started_at` columns · fixed a **pre-existing** Elysia
macro bug (`enabled: true` silently disabled guards — `platformAdminAuthenticated` was a
no-op on billing mutations before this branch).

### Doc fixes needed (staleness in `business-walletless-auth.md`)

1. §4.5/§9 — "2 new macros" → `requireStepUp` only (+`platformAdminAuthenticated`);
   `requireWallet` dropped with rationale.
2. §3/§4.7 — "arctic (Shopify provider)" → arctic generic OAuth2Client + manual exchange.
3. §4.6 — "12 routes total" → the list itself has 14.
4. §4.2/§9 — `orchestration/business-auth/` → BFF-layer composition.
5. §9 — "4 altered columns" undercounts (merchant_admins `added_by_account_id`,
   ownership-transfers +4 columns); `ip inet`/enum types are `text` in the schema.
6. §4.12 — document the `primaryDomain` body field and the custom-domain behavior change.

---

## 5. Suggested follow-up order

1. **A1** rate-limit registration routes (blocking)
2. **A2 + A3** TOTP replay guard + atomic recovery-code consume (before merge)
3. **P1** password-reset flow (before GA of email login)
4. **P3** infra env provisioning (with deploy)
5. **S1–S4 + A4** one cleanup pass (guard consolidation, dead code, upsert guards)
6. **Doc staleness** fixes 1–6 + record divergence D5
7. Backlog: A5/A6 (cron, macro re-resolution), S5–S8, P2 (ip column decision)
