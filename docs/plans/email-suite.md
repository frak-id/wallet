# Email Suite: Verification + Status + Rotation — Implementation Plan

**Scope (this round):** turn the currently-decorative email into a verifiable,
rotatable identity with a status. Three capabilities:

1. **Status** — an email carries a `verified_at` stamp (verified or not, and since when).
2. **Verification** — a 6-digit code sent by email (Resend), with a magic link that
   opens the verify screen with the code in the URL **hash**. Click-to-verify on the
   logged-in device, or type the code manually.
3. **Rotation** — change the email: the new address is added as a **pending** node;
   the existing verified email stays active until the new one is verified, then the
   old one is marked legacy (`unlinked_at`).

The email is the anchor for recovery, so **recovery setup is gated on a verified email**
this round.

> **Migration SQL is db-team owned** (per `services/backend/AGENTS.md`). This plan adds
> Drizzle table/column definitions only; they stay inert until the db team generates +
> runs the migration. Flag this in the PR.

---

## 1. Locked decisions

- **Storage model**: extend the existing `identity_nodes` model (email stays an identity
  node) + a new `email_verification_codes` table for the transient challenge. No separate
  `emails` table.
- **Verification gates recovery**: profile offers "Set up recovery" only once the email is
  verified.
- **Rotation = old-stays-until-new-verified**: no window without a valid email.
- **Auth model**: verification is **authenticated** — the code is matched against the
  current wallet session's identity group. Same-device link click auto-fills + submits;
  cross-device falls back to manual entry. 6 digits is safe because it is group-scoped,
  attempt-capped, expiring, and rate-limited (not a bearer token).
- **Single screen** (no multi-step flow): one `/profile/verify-email` screen with a
  send-code button + code input + status, unlike the recovery `SetupFlow`.
- **Code**: 6-digit **numeric**, 10-minute expiry, **30s resend debounce** tracked
  server-side (per group) + mirrored client-side. Max 5 verify attempts per code.
- **Link**: `${FRAK_WALLET_URL}/profile/verify-email#code=NNNNNN` — fragment only, never a
  query param (keeps the code out of the server, the Referer header, and access logs).
- **Resend**: direct REST API via `ky` (no SDK), mirroring the Airtable/OpenPanel
  integration style. `RESEND_API_KEY` secret populated manually after this lands.

---

## 2. Data model (`services/backend/src/domain/identity/db/schema.ts`)

### 2a. Extend `identity_nodes` (column add only)

```ts
// add to identityNodesTable definition
verifiedAt: timestamp("verified_at"),
```

- `null` = unverified (the default for every existing row and for non-email types).
- Set = the email node was verified at that instant.
- Rotation reuses the existing `unlinkedAt` column to mark a superseded email legacy.

Email-node lifecycle, expressed purely with `verified_at` + `unlinked_at`:

| State    | `verified_at` | `unlinked_at` |
|----------|---------------|---------------|
| pending  | `NULL`        | `NULL`        |
| verified | set           | `NULL`        |
| legacy   | set or `NULL` | set           |

### 2b. New `email_verification_codes` table (mirrors `install_codes`)

```ts
export const emailVerificationCodesTable = pgTable(
    "email_verification_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull(),
        // The address being verified (normalized). For rotation this is the
        // pending email; for a first verify it equals the current email.
        email: text("email").notNull(),
        code: varchar("code", { length: 6 }).notNull(),
        attempts: integer("attempts").notNull().default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        // Updated on every (re)send — drives the 30s debounce.
        lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
        consumedAt: timestamp("consumed_at"),
    },
    (table) => [
        // One active challenge per group; resend upserts on this target.
        uniqueIndex("evc_group_idx").on(table.groupId),
        index("evc_expires_at_idx").on(table.expiresAt),
    ]
);

export type EmailVerificationCodeSelect =
    typeof emailVerificationCodesTable.$inferSelect;
```

### 2c. Register the new table in the Drizzle barrel

`src/infrastructure/persistence/postgres.ts` — import `emailVerificationCodesTable`
alongside the other identity tables and add it to `drizzle({ schema: { ... } })`
(so `db.query.emailVerificationCodesTable` works). The `verified_at` column needs no
registration — `identity_nodes` is already registered.

---

## 3. Backend — repositories & service

### 3a. `EmailVerificationRepository` (new, identity domain)

`src/domain/identity/repositories/EmailVerificationRepository.ts`:
- `findByGroup(groupId): EmailVerificationCodeSelect | null`
- `upsert({ groupId, email, code, expiresAt })` — `insert(...).onConflictDoUpdate({ target: groupId, set: { email, code, expiresAt, lastSentAt: new Date(), attempts: 0, consumedAt: null } })`
- `incrementAttempts(groupId)`
- `consume(groupId)` — stamp `consumedAt` (or delete)
- `deleteExpired()` — housekeeping, same shape as `InstallCodeRepository.deleteExpired`

### 3b. Extend `IdentityRepository`

- `findEmailStatusForGroup(groupId): { email: string|null, verifiedAt: Date|null, pendingEmail: string|null }`
  - verified = newest active node (`unlinked_at IS NULL`) with `verified_at` set
  - pending = active node with `verified_at IS NULL`
  - `email` = verified ?? oldest active (keeps backward-compat with `findEmailForGroup`)
- `markEmailVerified(groupId, email)` — stamp `verified_at = now()` on the matching active node
- `unlinkOtherActiveEmails(groupId, exceptEmail)` — stamp `unlinked_at = now()` on every other active email node
- Keep `findEmailForGroup` (wallet-merge still uses it); have it prefer the verified node.

### 3c. `EmailVerificationService` (new, identity domain)

`src/domain/identity/services/EmailVerificationService.ts`. Single-domain + an
infrastructure email sender → a **service**, not an orchestrator (`api → service →
repository`). Constructor DI:

```ts
constructor(
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly identityRepository: IdentityRepository,
    private readonly emailSender: EmailSender, // interface; concrete = ResendClient
) {}
```

`sendCode({ groupId, email? })`:
1. Resolve target: `email` (rotation) or the group's current email. Normalize (`trim().toLowerCase()`).
2. **Rotation conflict check** (only when a *new* address is supplied): if the address is a
   verified node on a *different* group → return `{ status: "conflict", … }` (the existing
   merge path owns this; mirror `POST /auth/email`). Otherwise `addNode` it as a pending
   email on this group.
3. **Debounce**: if a row exists and `now − lastSentAt < 30s` → `{ status: "throttled", retryAfterSec }`.
4. Generate a 6-digit numeric code (`crypto.randomInt(0, 1_000_000)` zero-padded), upsert the
   row (`expiresAt = now + 10min`).
5. Build link `${FRAK_WALLET_URL}/profile/verify-email#code=${code}`, render the template, send
   via `emailSender.send(...)`.
6. `{ status: "sent" }`.

`verifyCode({ groupId, code })`:
1. Load the group's row; none/expired → `{ status: "expired" }`.
2. `attempts >= 5` → `{ status: "tooManyAttempts" }`.
3. Mismatch → `incrementAttempts` → `{ status: "invalid" }`.
4. Match → `markEmailVerified(groupId, row.email)`, `unlinkOtherActiveEmails(groupId, row.email)`,
   `consume(groupId)`, invalidate identity caches → `{ status: "verified", email, verifiedAt }`.

### 3d. Wire `IdentityContext` (`src/domain/identity/context.ts`)

```ts
const emailVerificationRepository = new EmailVerificationRepository();
const emailVerificationService = new EmailVerificationService(
    emailVerificationRepository,
    identityRepository,
    resendClient // imported from @backend-infrastructure
);
// repositories.emailVerification = emailVerificationRepository
// services.emailVerification = emailVerificationService
```

---

## 4. Backend — Resend integration (`src/infrastructure/integrations/resend/`)

Mirror `integrations/airtable` / `integrations/openpanel` (a `ky` instance + a thin class).

```ts
// ResendClient.ts
const resendApi = ky.create({
    prefix: "https://api.resend.com",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    timeout: 20_000,
    retry: { limit: 2, statusCodes: [429, 503], backoffLimit: 5_000 },
});

export class ResendClient implements EmailSender {
    async send({ to, subject, html }: SendEmailParams) {
        return resendApi
            .post("emails", {
                json: { from: process.env.RESEND_FROM_EMAIL, to: [to], subject, html },
            })
            .json<{ id: string }>();
    }
}
export const resendClient = new ResendClient();
```

- `EmailSender` interface lives in the identity domain (so the service depends on the
  abstraction, not the infra class).
- `buildVerificationEmail({ code, link })` → inline HTML template (code shown large + a
  "Verify my email" button → `link`). Keep it in the resend integration folder so future
  emails reuse the client.
- Export `resendClient` from the `@backend-infrastructure` barrel so `IdentityContext` can
  inject it.

---

## 5. Backend — API schemas & routes

### 5a. Schemas

New `src/api/schemas/emailVerificationSchemas.ts` (+ re-export from `api/schemas/index.ts`):

```ts
export const SendEmailVerificationBodySchema = t.Object({
    email: t.Optional(t.String({ format: "email", maxLength: 320 })),
});
export const SendEmailVerificationResponseSchema = t.Union([
    t.Object({ status: t.Literal("sent") }),
    t.Object({ status: t.Literal("throttled"), retryAfterSec: t.Number() }),
    t.Object({
        status: t.Literal("conflict"),
        authenticatorIds: t.Array(t.String()),
        wallet: t.Optional(t.Address()),
    }),
]);

export const VerifyEmailBodySchema = t.Object({
    code: t.String({ minLength: 6, maxLength: 6 }),
});
export const VerifyEmailResponseSchema = t.Union([
    t.Object({ status: t.Literal("verified"), email: t.String(), verifiedAt: t.String() }),
    t.Object({ status: t.Literal("invalid") }),
    t.Object({ status: t.Literal("expired") }),
    t.Object({ status: t.Literal("tooManyAttempts") }),
]);
```

Extend `MyEmailResponseSchema` (`authenticationSchemas.ts`) — **additive, backward-compatible**
(existing `useCurrentEmail` reads `.email`):

```ts
export const MyEmailResponseSchema = t.Object({
    email: t.Union([t.String(), t.Null()]),
    verified: t.Boolean(),
    verifiedAt: t.Union([t.String(), t.Null()]), // ISO timestamp
    pendingEmail: t.Optional(t.Union([t.String(), t.Null()])),
});
```

### 5b. Routes (`src/api/user/wallet/auth/email.ts`, same `sessionContext` + `withWalletAuthent` pattern)

- `GET /email` — extend to return `{ email, verified, verifiedAt, pendingEmail }` via
  `findEmailStatusForGroup`.
- `POST /email/verification` — body `SendEmailVerificationBodySchema` →
  `IdentityContext.services.emailVerification.sendCode({ groupId, email })`.
- `POST /email/verify` — body `VerifyEmailBodySchema` → `…verifyCode({ groupId, code })`.

Already covered by the existing `rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 })`
on `authRoutes`; the 30s debounce + 5-attempt cap are additional, per-group, DB-backed.
ECDSA sessions: keep the existing "no email / unsupported" guards.

---

## 6. Infra (`infra/`)

- `infra/config.ts`: `export const resendApiKey = new sst.Secret("RESEND_API_KEY");`
- `infra/gcp/secrets.ts` `elysiaEnv`: add
  - `RESEND_API_KEY: resendApiKey.value`
  - `RESEND_FROM_EMAIL: "noreply@frak.id"` (plain — non-sensitive sender; verified domain in Resend)
  - `FRAK_WALLET_URL: walletUrl` — **not currently in `elysiaEnv`**; required to build the link
    (import `walletUrl` from `../config`).
- AWS dev (`sst shell`): `RESEND_API_KEY` is available automatically as an `sst.Secret`;
  `FRAK_WALLET_URL` is already an `sst.Linkable`. Populate the secret post-merge
  (`sst secret set RESEND_API_KEY …` + GCP Secret Manager). **Ops prerequisite:** verify the
  `frak.id` sending domain in Resend before enabling in prod.

---

## 7. Frontend — module `apps/wallet/app/module/email-verification/`

### Hooks
- Extend `useCurrentEmail` (or add `useEmailStatus`) → expose `{ email, verified, verifiedAt, pendingEmail }`.
- `useSendEmailVerification` — `useMutation` → `authenticatedWalletApi.auth.email.verification.post({ email })`;
  owns a 30s cooldown (`cooldownUntil` state; sync to `retryAfterSec` on `throttled`).
- `useVerifyEmailCode` — `useMutation` → `authenticatedWalletApi.auth.email.verify.post({ code })`;
  on `verified`, `setQueryData(authKey.myEmail, …)` so the profile updates instantly.
- `queryKeys/email-verification.ts` — namespace mirroring `recoverySetupKey` (or extend `authKey`).

### Screen — `component/VerifyEmail/index.tsx` (single screen)
- Current email + status badge ("Verified on {date}" / "Not verified").
- **Send verification code** button → `sendCode()`; disabled while `now < cooldownUntil`, showing the countdown.
- Numeric `CodeInput` (`mode="numeric"`, length 6, interactive, `error`, `pasteLabel`) + **Verify** button.
- **Change email** affordance → reuse `EmailFormScreen` (or inline `Input`) to capture a new
  address → `sendCode({ email })`; on `conflict`, hand off to the existing `MergeFlow`
  (same as `AddEmail`).
- Terminal **verified** state via `EmailFlowResultScreen` → back to profile.

### Route + hash auto-verify
`apps/wallet/app/routes/_wallet/_protected-fullscreen/profile.verify-email.tsx` (fullscreen,
matching `add-email`):

```tsx
function readCodeFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.hash.slice(1)).get("code") ?? undefined;
}
function ProfileVerifyEmail() {
    const [initialCode] = useState(readCodeFromHash); // runs once, before router clears it
    return <VerifyEmail initialCode={initialCode} onCompleted={…} onAbort={…} />;
}
```

`VerifyEmail` prefills `CodeInput` from `initialCode` and auto-submits `verifyCode` on mount
when present. (Edge case to note in the PR: a not-logged-in user clicking the link may lose
the hash through the login redirect → manual entry fallback.)

---

## 8. Frontend — profile wiring (`ProfilePage/index.tsx`) + recovery gate

New 4-state row driven by `useCurrentEmail()` (now with `verified`) + on-chain recovery status:

1. no email → **Add my email** → `/profile/add-email`
2. email + **not verified** → **Verify my email** → `/profile/verify-email`
3. verified + (no recovery or expiring soon) → **Set up / Refresh recovery** → `/profile/recovery`
4. verified + recovery → **Recovery configuration** → `/profile/recovery`

Also: `AddEmail` success step (`SuccessStep`, `onSetupRecovery`) should route to
`/profile/verify-email` instead of `/profile/recovery`, since recovery is now gated on
verification.

---

## 9. i18n (`packages/wallet-shared/src/i18n/locales/{en,fr}/translation.json`)

New `wallet.verifyEmail.*` block (title, description, current-email/status copy, send-code
button + cooldown, code label/error, change-email, success) and `wallet.profile.verifyEmail`
("Verify my email"). Regenerate types: `bun run i18n:types`. No `StepIndicator` key needed
(single screen).

---

## 10. Security / risks

- **6-digit space (1M)** is acceptable here because the code is **group-scoped + session-bound**
  (not a bearer token), with a 5-attempt cap per code, 10-min expiry, 30s resend debounce, and
  the existing 10/60s rate-limit. Re-confirm before any unauthenticated/magic-link variant.
- **Code in URL hash** never reaches the server / Referer / logs. It does land in browser
  history; acceptable given the short TTL + single-use consumption.
- **Rotation conflict**: a new address already owned (verified) by another group routes into the
  existing wallet-merge flow — no new collision semantics.
- **Migration timing**: `verified_at` + `email_verification_codes` are inert until the db team
  ships the migration; e2e blocked until then — unit-test the service/flow in isolation.
- **Deliverability**: requires a verified `frak.id` sending domain in Resend (ops).
- **Numeric vs alphanumeric**: chose numeric ("6-digit"); the existing `generateCode`
  (`utils/sixDigitCode.ts`) is alphanumeric/ambiguity-free. Trivial to switch if preferred.

---

## 11. Task checklist

1. Backend schema: `identity_nodes.verified_at` + `email_verification_codes` table + barrel registration.
2. Backend: `EmailVerificationRepository` + `IdentityRepository` status/verify/unlink helpers.
3. Backend: `EmailSender` interface + `ResendClient` integration + email template + barrel export.
4. Backend: `EmailVerificationService` + `IdentityContext` wiring.
5. Backend: `emailVerificationSchemas.ts` (+ index export) + extend `MyEmailResponseSchema`.
6. Backend: extend `GET /email`, add `POST /email/verification` + `POST /email/verify`.
7. Infra: `RESEND_API_KEY` secret + `RESEND_FROM_EMAIL` + `FRAK_WALLET_URL` in `elysiaEnv`.
8. Frontend: hooks (status / send / verify) + query keys.
9. Frontend: `VerifyEmail` single screen + `profile.verify-email` route with hash auto-verify.
10. Frontend: `ProfilePage` 4-state gate + `AddEmail` success → verify redirect.
11. i18n keys (en + fr) + `bun run i18n:types`.
12. Tests (service: debounce / attempts / expiry / rotation; frontend: cooldown + auto-submit) + quality gate (`bun run typecheck` / `lint` / `format` / `test`).
13. PR notes: migration is db-team owned; populate `RESEND_API_KEY`; verify Resend sending domain.
```
