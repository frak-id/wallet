# Fix plan — business walletless auth (post-audit)

> Consolidates: the 5-way branch audit (2d3ad7c2), `docs/features/business-walletless-auth-audit.md`,
> and product decisions from review. Billing/campaign findings live in
> `docs/plans/billing-feature-fixes.md` — this plan is the auth surface only.
>
> Decisions recorded: TOTP replay guard (audit C2/A2) **declined** (threat model requires an
> attacker who already captured a valid code; not worth the counter-tracking complexity).
> Bearer token in localStorage **accepted** (no password is ever persisted — verified;
> only the session token is stored, which is the accepted model for the business app).

## Phase 1 — Blockers (before merge)

### 1.1 C1 · Inline-mint orphans custom-domain merchants
`services/backend/src/api/business/merchant/registration.ts:385-399` ×
`apps/shopify/app/services.server/merchant.ts:66-102` / `shop.ts:16-23`

The anti-claim hardening (register under the myshopify domain when `primaryDomain` isn't a
verifiable subdomain — i.e. always, for real custom domains) is correct and stays. The bug is
resolution: the Shopify app keys `resolveMerchantId`/`resolveMerchantInfo`/metafield writes on
`primaryDomain?.host ?? myshopifyDomain`, which misses forever after registration.

Fix (both sides, belt and suspenders):
- **Backend**: when `normalizedPrimaryDomain` exists and differs from the myshopify domain but
  fails `matchesShopDomain`, still persist it in `allowedDomains` (resolution alias only — it is
  NOT the registration `domain` and grants no domain-ownership elsewhere; `findByAllowedDomain`
  is exact-match). Keep `domain = normalizedShopDomain`.
- **Shopify app**: in `resolveMerchantId`/`resolveMerchantInfo`, fall back to a second
  `fetchMerchantFromBackend(shop.myshopifyDomain)` when the primary-domain lookup misses
  (myshopify domain is the stable identity; keeps pre-branch merchants registered under their
  custom domain working unchanged).
- Also removes the dead-code smell in the `usePrimaryDomain` branch and the
  `normalizedPrimaryDomain as string` cast (restructure the narrowing — no `as`).
- Tests: route-level test for `registerFromShopifySession` domain selection (custom domain,
  subdomain, myshopify-only, spoofed unrelated domain) — currently zero coverage; Shopify-app
  test for the fallback resolve.

### 1.2 A1 · Rate-limit merchant registration routes
`services/backend/src/api/business/merchant/registration.ts` — `POST /register`,
`GET /dns-txt`, `GET /verify` have no `rateLimitMiddleware` (every auth route has one).
`/register` triggers a real bank deployment and is reachable via the step-up-exempt embedded
branch; `/verify` is a domain-registration oracle. Add an IP-keyed limiter with a low ceiling
on the whole registration group.

### 1.3 M1 · SIWE freshness window (login + wallet link)
`services/backend/src/utils/siwe.ts` + `api/business/auth/login.ts` + `auth/link.ts`

Decision: no server-side nonce store — instead require message freshness. Enforce in
`verifySiweSignature` (opt-in param so the 2FA path, which already has nonce binding, can
also turn it on):
- `issuedAt` MUST be present and within **2 minutes** of server time (paired-wallet flows need
  phone unlock + wallet open — 2 min covers it), small forward-skew tolerance (~30s).
- Respect `expirationTime`/`notBefore` when present (viem's `validateSiweMessage` already can).
- Frontend: verify the wallet SDK sets `issuedAt` on the SIWE messages it mints (it should per
  EIP-4361 defaults); fix if absent.
- Tests: stale message rejected, fresh accepted, missing `issuedAt` rejected.

### 1.4 M2 · Shopify-SSO account stuck in `pending2fa` with zero methods
`api/business/auth/twoFactor.ts` `/2fa/setup` + `common.ts` `requireDbSession`

Allow `/2fa/setup` (and its `/2fa/activate` counterpart) from a **pending** session iff
`getEnabledTwoFactorMethods(account) === []` (the bootstrap case — mirrors the existing
`requireStepUpUnlessBootstrap` exemption). On successful first enrollment, stamp the session
`twoFactorVerifiedAt` so the user lands verified. Test: shopify account with no email/wallet
can enroll TOTP from pending and escape.

### 1.5 M4 + A4 · Atomic account upsert, narrow race catch
`domain/business-auth/services/BusinessAccountService.ts` (`upsertWalletAccount`,
`upsertShopifyAccount`)
- Make create+set a single statement (insert `ON CONFLICT` on the partial unique index) or a
  transaction that deletes the loser row — kills the email-squatting orphan.
- Narrow the catch to `isUniqueViolation` (rethrow the rest), like `linkWallet` already does.
- Add the missing `BusinessAccountService.test.ts` (race loser, email-prefill-taken branch,
  `getEnabledTwoFactorMethods`).

### 1.6 M5 · `TotpService.setup()` bare `Error` → `HttpError.conflict`
`domain/business-auth/services/TotpService.ts:90-92` — `HttpError.conflict("TOTP_ALREADY_ACTIVATED", ...)`.
Update the test to assert the typed error.

### 1.7 A3 · Atomic recovery-code consumption
`TotpService.verify` + `BusinessAccountRepository.consumeTotpRecoveryCode` — replace
check-then-remove with one conditional UPDATE:
`SET arr = array_remove(arr, $hash) WHERE id = $id AND $hash = ANY(arr) RETURNING id`,
derive the verify result from the returned row. Test: concurrent double-spend rejected.

### 1.8 M3 · Per-account lockout for TOTP/recovery verification (shared with email)
The IP-keyed limiter is bypassable; email OTP already has `attempts`/`MAX_VERIFY_ATTEMPTS=5`.
Approach — extract a generic failed-attempt gate shared by both channels:
- Add `two_factor_attempts int` + `two_factor_window_started_at timestamp` on
  `business_accounts` (windowed counter, same constants as `EmailOtpService`).
- Small shared helper (e.g. `domain/business-auth/services/attemptGuard.ts` or a method on
  `BusinessAccountRepository`): `assertAttemptAllowed` / `recordFailure` / `resetOnSuccess`.
- Wire into `TotpService.verify` (both TOTP and recovery paths). Refactor `EmailOtpService`
  onto the same helper if it stays cheap; otherwise keep its row-local counter and share only
  the constants (don't force the merge — the email counter lives on the code row by design).
- Test: 5 failures lock the account's TOTP verify for the window; success resets.

### 1.9 M9 · `useCompletePendingSession` silent expired-session mint
`apps/business/src/module/auth/hooks/useCompletePendingSession.ts:33-41` — treat a missing
`current: true` row in `GET /auth/sessions` as a hard error (throw → surfaced by the mutation),
never fall back to the placeholder `expiresAt`. Test the missing-current branch.

### 1.10 Password never in storage — verified, no action
Confirmed: `EmailPanel` keeps the password in transient component state only; the persisted
`authStore` holds `{token, wallet, accountId, authMethod, expiresAt, pending2fa}`. Documented
here so the question doesn't resurface.

## Phase 2 — Agreed fixes (with merge, not blocking)

### 2.1 `/auth/link/password` proper 409 + frontend surfacing
`api/business/auth/link.ts:88-100` — catch `isUniqueViolation` on `setEmail` →
`HttpError.conflict("EMAIL_TAKEN")`. Frontend: make sure `extractAuthErrorMessage` maps
`EMAIL_TAKEN` to a translated message in the linking UI (`LinkedCredentials`).

### 2.2 TOTP QR: render client-side, drop `dangerouslySetInnerHTML`
- Backend: `/2fa/setup` returns `otpauthUri` only; delete `qrSvg` from `TotpService.setup`
  and the response schema; drop the `uqr` dependency from `services/backend`.
- Business app: render the QR from `otpauthUri` with the `qr` package (same lib as
  wallet-shared's `PairingQrCode` — add `"qr"` to `apps/business` deps; do NOT import from
  wallet-shared, that's forbidden). Replace the `dangerouslySetInnerHTML` block in
  `TotpEnrollment.tsx`.

### 2.3 Shopify JWT verified once per request (+ A6 macro re-resolution)
`api/business/middleware/session.ts` + `registration.ts:resolveShopifySessionIdentity`
- Thread the already-verified `shopifySession`/`businessSession` from the derive context into
  `resolveShopifySessionIdentity` and the `businessAuthenticated`/`requireStepUp`/
  `platformAdminAuthenticated` macros instead of re-calling `verifyShopifySessionToken`/
  `resolveBusinessAuth` from raw headers (2-3 redundant verifications + DB session fetches per
  guarded request today, and a possible double sliding-expiry touch).
- Confirm Elysia resolve→macro ordering before relying on it; keep a fallback re-resolve only
  if ordering isn't guaranteed.

### 2.4 Merge the step-up guard trio (S1)
`twoFactor.ts:requireStepUpUnlessBootstrap` + `link.ts:requireFreshStepUp` + the inline check
in the `session.ts` `requireStepUp` macro → single `assertStepUpFresh(auth, { allowBootstrap? })`
in `api/business/auth/common.ts` (or `utils/stepUpRequired.ts`). Also S2: extract the
duplicated 22-line email-OTP send-or-throttle block inside `twoFactor.ts`.

### 2.5 Wire the post-login `redirect` search param
`apps/business/src/routes/login.tsx` parses `redirect` but nothing consumes it. Thread it
through `LoginPage` → all three panels' success paths + `PendingTwoFactor` completion →
`navigate({ to: redirect })` with a same-origin/relative-path-only guard (it's URL-controlled).
Test the guard (absolute external URL ignored).

### 2.6 Wallet login errors surfaced
`LoginMethods/WalletPanel.tsx:24-31` — replace `console.error` + return with the same
`extractAuthErrorMessage` + `FieldError` pattern as `EmailPanel`.

### 2.7 `merchant_admins.accountId` write path + walletless admin invite
Ownership transfer to walletless accounts already works (`transfer.ts` accepts `toAccountId`;
`OwnershipTransferService` handles both axes). What's missing is **adding an admin by account**:
- `MerchantAdminRepository.add`: accept `{ wallet } | { accountId }` (mirror the
  `MerchantIdentity` shape), keep `addedBy`/`addedByAccountId`.
- Schema: add a partial unique index on `(merchantId, accountId) WHERE account_id IS NOT NULL`
  (the existing `(merchantId, wallet)` unique doesn't dedupe NULL-wallet rows).
- `POST /:merchantId/admins`: accept `{ wallet } | { email }` — resolve email →
  `BusinessAccountRepository.findByEmail` at the API layer (cross-domain composition stays in
  the BFF layer, consistent with the branch's existing pattern); 404 when no account matches.
- `GET /admins` response + `remove`: include/handle account-only rows (response already allows
  `wallet: null` for the owner row; extend to admin rows + return an `email` label).
- Business app `TableTeam`: allow inviting by email, render walletless admins.
- Tests: account-only admin add/list/remove, duplicate-account rejected, authorization via
  `findByIdentity` account axis (finally exercising the currently-dead branch).

### 2.8 Move `MerchantIdentity` out of the service layer
`MerchantAdminRepository.ts:5` imports the type from `MerchantAuthorizationService`. Move
`MerchantIdentity` to `domain/merchant/schemas/index.ts`; both files import from there.

### 2.9 `EmailOtpService.hashCode` — drop `.toUpperCase()`
Codes are always `[0-9]{6}`; keep `.trim()` only.

### 2.10 PdfDownloadButton / auth-header helper
Extract the `x-business-auth` header construction shared by `backendClient.ts` `headers()` and
the raw PDF fetch in `BillingTable/index.tsx` into one helper; route the PDF fetch through
`stepUpAwareFetch` so a future step-up gate on the endpoint opens the 2FA modal instead of
failing opaquely. (Listed here because it touches the auth fetcher; the billing plan
references it.)

### 2.11 A5 · Cleanup cron for expired auth rows
Register a job calling `BusinessSessionRepository.deleteExpired()` +
`BusinessEmailCodeRepository.deleteExpired()` (precedent: `jobs/emailVerificationCode.ts`).

### 2.12 P2 · Populate `business_sessions.ip`
Pass the client IP (same extraction the rate limiter uses) into `session.create` at every
mint site (login, shopify callback, 2FA completion re-mints if any). Otherwise drop the column
before migrations are authored — decision: capture it (sessions UI already displays it).

### 2.13 M6 · Shopify shop-domain merchant lookup — cheap mitigation only
`MerchantAuthorizationService.getAccessibleMerchantIds` + `GET /merchant/my` both do
`findAll()` (500-row `SELECT *`) + in-app filter per request for any Shopify-linked account.
Merchant count is small today; full SQL-side subdomain matching is deferred. Now:
- Deduplicate the two call sites onto one service method.
- Optional: small in-process TTL cache (`shopDomain → merchantIds`, ~60s) if it stays trivial.
- Backlog note in code for the indexed query (`domain = $1 OR domain LIKE '%.' || $1` + unnest
  on `allowedDomains`) when merchant volume grows.

## Phase 3 — Tests (after fixes land)

- `BusinessAccountService.test.ts` (new — 1.5).
- `registerFromShopifySession` route tests (1.1).
- `businessSessionContext`/`hasMerchantAccess` authorization matrix: wallet-only,
  account-only, shopify-domain fallback (null domain → no access), platform-admin bypass
  unreachable on unsafe methods (currently untested).
- Business app: `useCompletePendingSession` missing-current branch (1.9),
  `PendingTwoFactor` effect (cancel path, hash-token adoption, double-invoke guard),
  `useShopifySsoRedirect` domain validation, post-login redirect same-origin guard (2.5),
  walletless admin invite flow (2.7).
- SIWE freshness cases (1.3), TOTP lockout window (1.8), recovery double-spend (1.7).

## Open product decisions (not scheduled)

- **P1 · Password reset / email change flow** (audit §P1): password-only account with a
  forgotten password has no recovery path. `business_email_codes` machinery is ~90% of the
  implementation. Decide: block GA of email login on it, or accept short-term.
- **P3 · Infra provisioning at deploy**: `RESEND_SECURITY_FROM_EMAIL` + `BUSINESS_URL` must be
  wired in `infra/gcp/secrets.ts` (code silently falls back to `noreply@` today). Deploy
  checklist item, not a code fix on this branch.
- Declined (recorded): TOTP replay counter (C2/A2), server-side SIWE nonce store (superseded
  by 1.3 freshness window), `buildPostgresUrl` bootstrap dedup, A7 setupCode constant-time
  compare (deprecation path).

## Backlog (opportunistic, from audit S-items)

- S3 dead code: `TotpService.isActivated`, `BusinessAccountRepository.clearTotp` (no
  disable-TOTP route — either wire a route or delete), `isLegacyJwt` written-never-read,
  `ShopifyAssociatedUser.accountOwner`, `STEP_UP_ERROR_CODE` re-export, unused domain barrel
  exports. (`deleteExpired` pair leaves this list via 2.11; `ip` via 2.12.)
- S4: delete `getPasswordAccountByEmail`/`getWallet` pass-throughs, call the repo.
- S5: single `TwoFactorMethodDto` (declared 5× backend-side; removes a frontend cast).
- S6: `sha256Hex` + `constantTimeStringEqual` helpers in `@backend-utils` (4 hand-rolled
  copies with inconsistent length pre-checks).
- S7: move `extractAuthErrorMessage` out of `useTwoFactorChallenge.ts` (6 unrelated importers).
- S8: interpolate `PasswordService.MIN_LENGTH` instead of the literal `10` ×4.
- `business-auth` schema timestamps lack `withTimezone` while driving expiry/step-up/OTP
  security math (only `affiliate` uses timestamptz today). Decide repo-wide: pin DB session
  timezone to UTC and document, or migrate these columns. Don't do it piecemeal.
- Design-doc staleness fixes 1-6 from the audit doc §4 (macro count, arctic wording, route
  count, orchestration dir, §9 column counts, §4.12 primaryDomain behavior — update §4.12
  again after 1.1 lands).
