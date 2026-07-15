# Business auth — pending-email verification (item 2 exploration)

Goal: an email attached to a business account must be **pending** until proven,
and both entry points that attach one — **signup** and **add email/password to
a wallet account** — must drive the user through verification (resend-able,
with an email deep link), mirroring the wallet's pending-email pattern.

## 1. Current state (what already exists)

- **Schema — no migration needed.** `business_accounts` already has
  `email` (partial-unique index) + `email_verified_at timestamp NULL`.
  `pending` is exactly `email_verified_at IS NULL`.
- `BusinessAccountRepository.setEmail` already resets `email_verified_at = null`
  when attaching/rotating an email; `markEmailVerified` stamps it.
- `markEmailVerified` is called from three places, all inside the 2FA surface:
  - `login /2fa/verify` (email branch) — first-login email OTP.
  - `/2fa/activate` (email branch) — email-2FA enrollment.
  - `verifyProof` email branch.
- `email_verify` OTP purpose + `EmailOtpService.sendCode/verifyCode` already
  exist (attempts cap, resend debounce, hourly window, hashed at rest).
- Wallet reference pattern (`identity/EmailVerificationService`): unverified
  address is kept **off** the identity graph (lives on the challenge row) until
  the code is entered; verification email carries
  `${FRAK_WALLET_URL}/profile/verify-email#code=…`; the `/verify-email` route
  reads `#code=` from the hash and auto-submits.

## 2. The real gaps

### 2a. Signup — mostly already covered
`/register` creates the account with an unverified email; the **forced** email
2FA on first login (`/login/password` → pending → `/2fa/verify`) calls
`markEmailVerified`. So there is **no window** where an unverified password
logs in without verifying. Gaps are cosmetic/robustness:
- Nothing surfaces the pending state.
- The login email challenge has **no resend button** (only a one-shot "Send
  code by email"; once sent there is no re-send affordance).

### 2b. Add email/password to a wallet account — the actual hole
`/link/password` today:
1. `setEmail` (attaches email, `email_verified_at = null`),
2. `setPasswordHash`,
3. fire-and-forget `sendCode(email_verify)`,
4. returns `{ linked: true }`; UI shows "check your email to verify it" and
   **stops** — no code entry, no resend, no completion, no gate.

Consequences:
- The user is never asked for the code; the email stays pending forever unless
  they later log out and back in via the password (which forces email 2FA).
- **Email squatting (security).** Because `setEmail` writes the address to the
  account row (and its unique index) *before* proof, a wallet user can attach —
  and thereby lock — an email they don't own. A later legitimate `/register`
  for that address hits the existing-row branch and is refused (enumeration-safe
  generic response), locking the rightful owner out. The wallet pattern avoids
  this precisely by keeping the unverified address off the account until proven.

## 3. Design decisions (need a call)

- **D1 — Where does the pending email live?**
  - *(A) Keep on the account row* (`setEmail` now), pending = `verified_at NULL`.
    Simplest, matches today. Keeps the squatting vector.
  - *(B) Mirror the wallet*: do **not** `setEmail` until the code is verified;
    hold the pending address on the `business_email_codes` row (needs an
    `email` column there) or a scratch field. Closes squatting. Bigger change,
    and complicates "email + password" since the password is set before the
    email is proven (or we also defer the password).
  - Recommendation: **B for the add-flow** (squatting is a real pre-auth-ish
    lock), **A for signup** (register already gates the whole account behind
    first-login email 2FA, and the account is otherwise empty).

- **D2 — Reuse `/2fa/*` or a dedicated email-verify surface?**
  - `/2fa/setup{method:email}` already re-sends an `email_verify` code, and
    `/2fa/activate{method:email}` verifies it + `markEmailVerified`. But
    `activate` also stamps the **session** stepped-up, conflating concerns.
  - Recommendation: add a small dedicated pair
    `POST /auth/email/verify/request` + `POST /auth/email/verify/confirm`
    (authenticated, pending-session-friendly) that only sends/consumes the
    `email_verify` code and stamps `email_verified_at`. No session-step-up side
    effect. Resend = call `request` again (debounce already enforced).

- **D3 — Gate login on verification?** Not needed and slightly harmful: the
  verification mechanism *is* the first-login email 2FA. A hard "reject
  unverified password login" would deadlock (can't verify without logging in).
  Keep: unverified is allowed to start login, and the forced email 2FA verifies.

- **D4 — Deep link.** Add `link` to `buildSecurityCodeEmail` (or a dedicated
  business verification email) → `${BUSINESS_URL}/verify-email#code=…`. Login
  2FA deep links only work in the **same browser** (pending session token in
  that tab's localStorage) — acceptable, falls back to manual entry. The
  add-flow deep link always works (user is authenticated in that browser).

## 4. Change map (recommended slice)

Backend
- `EmailOtpService.sendCode`: accept an optional `link` and pass to the email
  builder; build `verifyUrl` per purpose in the callers.
- `buildSecurityCodeEmail`: add an optional `link` → render the CTA button
  (copy the `buildVerificationEmail` button markup). Keep the code visible.
- New `services/backend/src/api/business/auth/email.ts`:
  `POST /auth/email/verify/request` (resend) + `POST /auth/email/verify/confirm`
  (verify `email_verify` → `markEmailVerified`). Authenticated, pending-ok.
- `/link/password`: if D1=B, stop calling `setEmail`; instead stash the pending
  email on the challenge row and only attach on confirm. If D1=A, leave as-is
  and just rely on the new confirm endpoint.
- Optionally extend `GET /auth/2fa/methods` → also return
  `{ email, emailVerified }` (or a new `GET /auth/account`) so the UI can show
  pending state.

Frontend
- `AddPasswordForm`: after `linkPassword` success, render a **verify step**
  (6-digit input + verify + **resend** + deep-link autofill) instead of the
  terminal "check your email" notice. On success → connected + verified.
- `TwoFactorModal` email challenge (`CodeChallenge`): add a **resend** button
  (re-calls `/2fa/challenge{email}`; respects the 60s debounce → show
  countdown/disabled).
- New route `apps/business/src/routes/verify-email.tsx` reading `#code=` from
  the hash (mirror wallet's `readCodeFromHash`) → auto-submit the confirm.
- `LinkedCredentials`: show the email row with a **Pending / Verified** badge;
  offer resend when pending.
- i18n en+fr for the new copy; `bun run i18n:types`.

## 5. Risks / notes
- D1=B touches the `business_email_codes` schema (add `email` column) → **one
  migration** via `services/bootstrap` `db:generate:*`. D1=A needs none.
- Squatting is the main security argument for doing the add-flow properly.
- Deep-linking codes overlaps with the previously-parked "item 3"; doing it here
  covers the high-value cases (verify-email + reset) without the cross-device
  login-2FA caveat being a blocker.
- Keep all responses that could reveal account existence generic where the
  endpoint is unauthenticated; the new email-verify endpoints are authenticated,
  so they can return precise errors.
