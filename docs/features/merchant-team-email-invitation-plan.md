# Merchant Team — Email Invitation Flow (Plan)

## Goal

Allow a merchant owner/admin to invite a team member by email from the team table:

- Email belongs to an existing business account → added directly as admin (already works today).
- Email is unknown → the person is shown as **"Invited"** in the team table, receives an invitation email, and can complete a registration flow (email prefilled, invite context shown) that lands them directly as a merchant admin.

Constraints: KISS, **no new DB table**, maximum reuse of existing auth/email/admin machinery.

## Core design decision: "invited" = credential-less business account

Instead of a new `invitations` table, we reuse two existing rows:

1. **`business_accounts`**: pre-create an account with only `email` set (no `password_hash`, no `shopify_user_id`, no `wallet_address`, `email_verified_at` null). The schema already allows this (all credential columns are nullable, one-of constraints are on merchants, not accounts).
2. **`merchant_admins`**: insert the admin row immediately with `account_id` (already supported — walletless admins exist today).

"Invited" status is **derived**, not stored: an admin whose linked account has zero credentials is `invited`; otherwise `active`.

The invitation link is a **stateless JWT** (new `JwtContext.businessInvitation`, reusing the existing `buildJwtContext` factory — same pattern as `anonymousMerge`). No token persistence:

- Payload: `{ typ: "business-invitation", sub: accountId, merchantId, email, invitedBy? }`, TTL 7 days, secret `JWT_BUSINESS_SECRET`.
  - The literal `typ` discriminator is **required**: the secret is shared with the legacy business session JWT, and today cross-acceptance is only prevented by schema shape (`BusinessTokenDto` requires `wallet`). The discriminator makes token-type confusion structurally impossible (review finding).
  - `invitedBy` is nullable — legacy-JWT sessions can have `accountId: null` (`resolveBusinessAuth.ts:35`).
- Replay-safe: the claim endpoint rejects accounts that already have a credential.
- Revocation: removing the admin row via the existing DELETE revokes merchant access. **Claim deliberately never inserts/rechecks the admin row** — that's what makes "DELETE = revocation" sound (otherwise a leaked link could resurrect revoked access for 7 days). Worst case a revoked invitee claims into an access-less account, equivalent to normal registration.
- Resend: re-calling the add endpoint re-mints a token and resends (admin insert is `onConflictDoNothing`, so it's naturally idempotent).

Clicking the emailed link **is** proof of email ownership (same reasoning the codebase already uses: "receiving the OTP IS the ownership proof"). So the claim flow can mark the email verified and mint a fully 2FA-verified session — **no separate 2FA step during onboarding** (answering the user's "could 2FA be skipped?" question: yes, safely, because the invite token plays the role of the email factor).

## Backend changes (`services/backend`)

### 1. JWT context — `src/infrastructure/external/jwt.ts`
- Add `JwtContext.businessInvitation = buildJwtContext({ secret: JWT_BUSINESS_SECRET, ttl: 7d, iss: "frak.id", schema: BusinessInvitationTokenDto })`.
- New DTO `src/domain/business-auth/models/BusinessInvitationTokenDto.ts`: `{ sub: accountId, merchantId, email, invitedBy }` (mirrors `AnonymousMergeTokenDto`).

### 2. Invitation email template — `src/infrastructure/integrations/email/buildInvitationEmail.ts`
- New builder next to the existing three: subject "You've been invited to join {merchantName} on Frak", CTA button to `${BUSINESS_URL}/invite#token=…` (secret in URL **fragment**, per existing convention). Sender: `RESEND_SECURITY_FROM_EMAIL` fallback default, via existing `resendClient`.
- **HTML-escape `merchantName` and inviter `displayName`** — this is the first template embedding user-controlled strings (existing builders only interpolate server-generated codes/links); unescaped values would be an HTML/phishing injection vector inside a DKIM-signed frak-labs.com email.

### 3. Extend admin add — `src/api/business/merchant/admins.ts` (POST, already `requireStepUp`)
Replace the current 404 branch (`"No account found for this email"`, ~:135). Branch logic:
- `findByEmail` hit **and account has a credential** → existing behavior (direct add). Response includes `status: "added"`.
- `findByEmail` hit **and account is credential-less** → **always take the invited path** (idempotent admin add + mint token for *this* `merchantId` + send email + `status: "invited"`). This single branch covers both resend and a second merchant inviting the same not-yet-claimed email (review finding: gating on "already admin of this merchant" would silently skip the email for cross-merchant invites).
- `findByEmail` miss → in order:
  1. Create credential-less account: new `BusinessAccountService.createInvitedAccount(email)` (lowercased email, nothing else; handle unique-violation race by re-fetching).
  2. `MerchantAdminRepository.add({ merchantId, identity: { accountId }, addedBy… })` (existing, idempotent).
  3. Mint invitation JWT, send `buildInvitationEmail` via `resendClient` (merchant name from the merchant row, inviter display name/email from session account, null fallback → "a team admin").
  4. Response `status: "invited"`.
- **Response shape**: keep it additive — `AdminDto & { status: "added" | "invited" }` (current 200 is `AdminDto`; don't break the Eden type).
- Throttling: endpoint is step-up-protected and admin-only; Resend's per-call `Idempotency-Key` plus this gate is enough for v1 — no counters table. Residual risk: a hostile admin can burst-send within the 5-min step-up window; optionally mount the house-style `rateLimitMiddleware` on the admins router.

### 4. Expose invited status — same file, GET admins list (~:43)
- The list already does a per-row `findById` for `emailForAccount` (admins.ts:30-37) which returns the full account row — derive `status: "invited" | "active"` from it (invited ⇔ all of `passwordHash`, `shopifyUserId`, `walletAddress` null). **No repository select change needed**; zero extra queries. Only the derived `status` string crosses the API, never credential columns.
- The synthesized owner row gets `status: "active"`.

### 5. New invite endpoints — `src/api/business/auth/invite.ts` (mounted under `/business/auth/invite`, public/unauthenticated)
- **Mount `rateLimitMiddleware`** like every other `/business/auth` router (login.ts:39 style, ~10/min) — `/claim` does an argon2id hash per call, so unthrottled it's a cheap CPU DoS.
- Both endpoints return **generic errors** on any invalid/expired token (enumeration-safe), and are **session-agnostic** (ignore any `x-business-auth` header — a stale session must not misdirect the credential set).
- `POST /preview` `{ token }` → verify JWT (incl. `typ`) → load merchant + inviter → return `{ email, merchantName, inviterName, valid, alreadyClaimed }`. Used by the landing page to render "You've been invited to be an admin of X". `inviterName` falls back to "a team admin" when `invitedBy` is null.
- `POST /claim` `{ token, password, displayName? }` →
  1. Verify JWT signature + expiry + `typ`.
  2. Load account by `sub`; reject if it already has any credential (`alreadyClaimed`) or email mismatch (defense-in-depth).
  3. `PasswordService.assertValid` + argon2id hash → set `password_hash`, `display_name`, `email_verified_at = now()` (link click = ownership proof; same trust argument as `password/reset/confirm` and first email-2FA).
  4. `BusinessSessionService.create(...)` with `two_factor_verified_at = now()`, `auth_method: "password"` → return `{ token, expiresAt, hasMerchantAccess }` (same shape as login, but **not** pending; `hasMerchantAccess` = one `isAdmin` check so the frontend doesn't navigate a revoked invitee into a 403).
  - Admin row presence is never inserted/re-checked here (see revocation rationale above).
  - Note: the claimed session opens the 5-min step-up window (like SIWE login / email-2FA) — the fresh admin can immediately perform sensitive actions. Consistent with existing semantics; stated for the record.
  - Note: claim is a third path that stamps `email_verified_at`; a verified `@frak-labs.com` email grants platform-admin (PlatformAdminService). Not an escalation — only the mailbox owner holds the token, same guarantee as OTP verification.

### 6. Unbrick self-service: relax password reset for credential-less accounts — `src/api/business/auth/login.ts:165,:193`
Today both reset endpoints gate on `account?.passwordHash`, and `/register` silently no-ops on an existing row. Without a change, an invited email is **dead-ended** if the link expires: register no-ops, login fails, reset never sends a code — and since any admin can invite an arbitrary email, that's a griefing vector (brick an email's self-registration forever).
- Fix: allow the reset flow when the account is credential-less (`passwordHash || isCredentialLess(account)` at :165, mirror at :193). Safe — the OTP still proves mailbox ownership, exactly like link possession. Reset then sets a password + verifies email; a later claim correctly reports `alreadyClaimed`.
- **Do NOT make `/register` adopt credential-less rows**: register is unauthenticated and pre-verification; an attacker guessing an invited email could set the password first and burn the claim. The register no-op is protective — keep it.

### 7. No schema migration
Zero DDL. Optional nicety (defer): a cleanup job for orphaned credential-less accounts with no admin rows — not needed for v1. (Known cosmetic quirk: a crash between `create` and `setPasswordHash` in `/register` can leave an organic credential-less row that would render as "Invited" — rare, harmless.)

## Frontend changes (`apps/business`)

### 1. Add-member sheet — `src/module/merchant/component/ButtonAddTeam/index.tsx`
- Email tab: no longer surfaces the 404 error; success toast differentiates `added` vs `invited` ("Invitation sent to …") based on the new response field. Minor copy/i18n additions.

### 2. Team table — `src/module/merchant/component/TableTeam/index.tsx` + `useGetMerchantAdministrators.ts`
- Add `status` to `MerchantAdministrator` type; render an **"Invited"** badge next to the email for pending members (reuse existing badge styling used for Owner/Admin).
- **"Resend invite" row action (v1)** — shown only for `status: "invited"` rows. No new endpoint or hook: it re-calls `useAdminMutation({action:"add"})` with `{merchantId, email}`, which hits the unified credential-less branch (idempotent admin add + fresh 7-day token + resend). Rationale: invitees frequently ignore the first email and only look for it once they actually need access, by which point the link may have expired. Success toast "Invitation resent to …"; step-up modal may trigger (same as add/remove). Note the action is naturally idempotent — double-click just re-sends.
- Removal of an invited member uses the existing DELETE unchanged.

### 3. Invite landing route — `src/routes/invite.tsx` (new, public)
- Reads `#token=…` from the URL fragment (same pattern as `/login/2fa#token=` adoption in `PendingTwoFactor`).
- Calls `POST /auth/invite/preview` → renders inside the existing `Login` shell: **"You've been invited to be an admin of {merchantName} on Frak"** + read-only prefilled email + password (+ confirm) + display name fields. Reuse form patterns/validation from `EmailPanel`'s `RegisterForm`.
- Submit → `POST /auth/invite/claim` → store `{token, wallet:null, accountId, authMethod:"password", pending2fa:false}` in `useAuthStore` → if `hasMerchantAccess`, `navigate` to `/m/{merchantId}` dashboard, else to the merchant list/home. **No `/login/2fa` step.**
- Edge states: expired/invalid token → friendly error with "ask your admin to resend the invitation" (matching the resend row action above); `alreadyClaimed` → redirect to `/login` with the email context ("This invitation was already used — sign in instead").
- If a user is already authenticated when opening the link: if same email, show "you already have access / open dashboard"; otherwise prompt logout. (Simple guard, small component state.)

### 4. Eden client types
- Regenerate/pick up new backend route types automatically via the Eden treaty (`authenticatedBackendApi` / public client for the invite endpoints).

## Edge cases & security notes

| Case | Handling |
|---|---|
| Invitee registers normally via `/register` before clicking the link | Register is enumeration-safe and **no-ops** on the existing row (protective — see §6). The invitee activates via the claim link, or self-serves via password reset once §6 is in (OTP → password + verified email); both converge. |
| Invitee signs in via Shopify SSO with the same email | Confirmed against code: `upsertShopifyAccount` matches by shopify_user_id and only prefills email when free → it creates a **separate** email-less account. The admin row stays bound to the invited account and the claim link still works. Acceptable v1 outcome. |
| Token leaks | Fragment-only transport (never hits server logs), 7-day TTL, single-use in effect (claim rejects credentialed accounts), `typ` discriminator prevents session-token confusion, grants only "become this account", not session theft. |
| Enumeration | Add-endpoint is authenticated + step-up; preview/claim return generic errors on invalid tokens; login/reset stay constant-work (credential-less accounts indistinguishable from nonexistent). |
| Resend spam | Only merchant owner/admins can trigger, behind step-up; acceptable without counters for v1 (optional: rate limit on admins router). |
| Invited admin removed before claim | Admin row gone → claim still activates the account but grants no access (`hasMerchantAccess: false` routes them away from a 403); harmless by design. |
| Duplicate invite to same email from two merchants | Second invite hits the unified credential-less branch → adds a second admin row **and sends its own email**. Claim via either link works; both admin rows apply. |
| Link opened while logged into a different account | UI prompts logout; claim endpoint ignores session headers so a stale session can't misdirect credentials. |

## Out of scope (explicitly deferred)

- Role selection (only implicit owner/admin exists today — invitees become admins).
- Invitation expiry surfaced in UI (JWT expiry only; the resend action covers it).
- "Invited N days ago" hint on invited rows (the `addedAt` column already exists if wanted later).
- Orphan credential-less account cleanup job.
- Send-rate counters for invitation emails.

## Test plan

- **Backend (vitest, existing project `backend`)**: admins POST unknown-email → account+admin created, status invited; credential-less hit → invited path (resend + cross-merchant); credentialed hit → direct add; claim happy path (session 2FA-verified, email verified, `hasMerchantAccess`); claim rejects credentialed account / bad signature / expired / wrong-`typ` (legacy business JWT) / email mismatch; preview output incl. null-inviter fallback; GET list `status` derivation + owner `active`; password reset works for credential-less account.
- **Frontend**: ButtonAddTeam invited toast; TableTeam invited badge + resend action (calls add mutation, resent toast, hidden for active/owner rows); invite route states (valid / expired / claimed / already-authenticated).
- **E2E (optional)**: invite → claim → land on merchant dashboard.

## Implementation order

1. Backend: JWT context + DTO (with `typ`), email builder (escaped).
2. Backend: `invite.ts` routes (preview/claim, rate-limited) + `createInvitedAccount`.
3. Backend: admins POST invited branch + GET status field.
4. Backend: password-reset relaxation for credential-less accounts (§6).
5. Frontend: invite landing route + claim form.
6. Frontend: ButtonAddTeam/TableTeam polish (toast, badge, resend row action).
7. Tests, i18n strings, docs touch-up.

---

*Plan validated against actual code by independent reviewer + oracle agents; all blocker/high findings incorporated (unified credential-less invite branch, JWT `typ` discriminator, rate limiting, HTML escaping, password-reset unbrick, additive response shape).*
