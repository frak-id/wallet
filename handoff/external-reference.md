# External Reference: Read-Only Platform-Admin / Merchant View in a Multi-Tenant SST SaaS

Research compiled for implementing a small set of platform/superadmins (identified on the
backend via an SST Secret allow-list) who can VIEW any merchant dashboard + stats in strict
READ-ONLY mode for debugging. Focus: smallest viable, KISS/DRY, backend-enforced design.

---

## 1. Common patterns for read-only god-mode / merchant-impersonation

The canonical reference is Pigment's "Impersonation Done Right" (production enterprise SaaS).
Four non-negotiable design principles, all directly applicable here:

- **Read-only by default.** "Impersonation is for observing, not acting... If the impersonation
  feature can't guarantee this, it shouldn't exist."
- **Time-bounded sessions.** They use 30-minute auto-expiry to limit blast radius of a
  compromised/forgotten session. Renew by starting a new session.
- **Full audit trail.** Who impersonated whom, when, in which org. Required for SOC2/GDPR and
  customer trust. The impersonated org can see these logs.
- **Scoped to impersonator's own access.** Impersonation is the *intersection* of both users'
  access, never a union — it must never grant access the admin couldn't already reach.

Key architectural decision — **separate token, not a flag on the existing session**:
> "the backend doesn't just flip a flag on the existing session. Instead, it issues a brand-new
> JWT token with claims that encode... the impersonated user's identity... the impersonator's
> identity (separate claim)... a read-only flag embedded directly in the token... an expiration."

Advantage: every backend service just sees a normal user request for the impersonated user.
You don't have to teach each service about impersonation; the impersonation metadata rides
alongside (used only by audit logging and the write-guard). This is the DRY win.

Frontend: the impersonation token is stored **separately** from the admin's own auth token, so
the admin's session is never overwritten; ending impersonation reverts cleanly. Enables a
visible indicator (dark border around the whole screen) and per-tab impersonation.

Industry note (Ory): the legacy "log in as user" with shared session / shared password is now
considered an anti-pattern (no audit trail, full write access). The modern standard is explicit,
scoped, audited, read-only impersonation tokens.

Sources:
- https://engineering.pigment.com/2026/04/08/safe-user-impersonation/ (primary, most detailed)
- https://www.ory.com/blog/identity-level-impersonation
- https://ripeseed.io/blogs/practical-user-impersonation
- https://github.com/purposestack/givernance/blob/main/docs/19-impersonation.md
- https://github.com/lucashhoffmann/nestjs-jwt-shield (JWT `act` actor claim convention)

---

## 2. SST v3 Secrets: defining, consuming, and storing an admin allow-list

From SST docs (sst.dev):

- **Define** in `sst.config.ts` / infra:
  ```ts
  const adminEmails = new sst.Secret("PlatformAdminEmails");
  ```
- **Set the value** via CLI (not committed to source):
  ```bash
  npx sst secret set PlatformAdminEmails "ops@acme.com,founder@acme.com"
  ```
- **Storage**: In SST v3, secrets are NOT in SSM. They are encrypted and stored in your state
  file, encrypted with a passphrase stored in SSM. When used in function code they are encrypted
  into the bundle and decrypted synchronously at function startup by the SST SDK (no top-level
  await needed, unlike v2).
- **Consume** by linking the secret to the backend function/service, then reading via the
  `Resource` proxy (type-safe, reads from injected env vars):
  ```ts
  // infra: link it
  new sst.aws.Function("Api", { link: [adminEmails], handler: "..." });

  // runtime
  import { Resource } from "sst";
  const allowList = Resource.PlatformAdminEmails.value
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  ```
- `bind` was renamed to `link` in v3 ("resource binding" -> "resource linking"); all linked
  resources are accessed through the `Resource` object.
- For `sst dev`, linked resources (incl. secrets) are injected into the env automatically.

**Safest storage for the allow-list:** keep it as a single SST Secret (comma-separated emails
or user IDs) linked ONLY to the backend service that needs it — never to the frontend bundle,
never in plaintext env files or repo. Prefer matching on **stable user IDs** over emails where
possible (emails change / can be re-pointed); if matching on email, require the email to be
verified by the IdP. Normalize case on both sides.

Sources:
- https://sst.dev/docs/component/secret
- https://sst.dev/docs/linking/
- https://sst.dev/docs/reference/sdk
- https://sst.dev/docs/migrate-from-v2/

---

## 3. Deriving `isPlatformAdmin` from session + secret allow-list

Pattern (confirmed by SST secret docs + impersonation references):

1. Authenticate the request normally -> resolve the real user's identity (verified email / sub).
2. On the **backend only**, compare that identity against the secret allow-list:
   ```ts
   const isPlatformAdmin = allowList.includes(session.user.email.toLowerCase());
   ```
3. Derive the claim server-side; **never trust an `isPlatformAdmin` value sent from the client.**
   Real-world example of exposing such a claim on a session: objectstack-ai/framework commit
   "expose isPlatformAdmin on the customSession user" — derived server-side from admin status,
   then surfaced to the session payload (UI hints only).
4. When an admin chooses to view a merchant, mint an impersonation token/session carrying:
   `actorUserId` (real admin), `subjectMerchantId` (viewed tenant), `readOnly: true`, `exp`.
   The JWT `act` (actor) claim (RFC 8693) is the standard place for the real operator identity.

KISS variant for this codebase: if you already have server-side sessions, you can carry an
`impersonation: { actorId, merchantId, readOnly: true, exp }` block in the session record
instead of a separate JWT — as long as the read-only flag and actor identity are server-held
and re-checked on every request. The separate-token approach is cleaner but heavier; the
server-side session-block approach is the smaller viable version.

---

## 4. Enforcing read-only at the API layer (why backend, not UI)

**Backend enforcement is mandatory; UI disabling is cosmetic.** Multiple sources converge:

- Pigment: "The read-only flag lives in the JWT itself — it's not a frontend-only guard. Every
  API request passes through authentication middleware that checks this flag. If the request
  targets a mutating endpoint and the session is read-only, the middleware rejects it with a 403
  and a specific response header before it ever reaches any business logic."
- Agnitestudio: "UI labels are not enough... The backend has to re-check tenant scope, action
  scope, and operator rights on every request because the real risk is in the request path, not
  the button text."
- PacketWanderer threat list explicitly includes: attacker can "start impersonation through the
  API even if the UI hides the button" and "attempt a write even though the UI is read-only."

**Write-guard middleware design (the core enforcement):**
- A single middleware/guard runs on every request. If `session.impersonation?.readOnly` is true
  AND the endpoint is a mutation, reject with `403` + a distinct header
  (e.g. `X-ReadOnly-Impersonation: true`) so the frontend can show a friendly message.
- **How to classify mutations (smallest viable options, pick one):**
  - HTTP-method based: block `POST/PUT/PATCH/DELETE` for impersonated sessions (simple, but
    watch for read-only GETs that have write side-effects and write-y POSTs that are actually
    reads/searches).
  - Explicit endpoint tagging: each route declares `readOnlyAllowed: true | false`. Pigment's
    biggest insurance was a **build-time check (linter) that fails the build if any endpoint is
    untagged** — guarantees new endpoints can't silently bypass the guard months later. This is
    the DRY/maintainability keystone if the API surface grows.
- Important nuance from Pigment: not all writes in a read-only session are illegitimate (audit
  log writes, cache/stats updates, token revocation). So pure infra-level "block all DB writes"
  is brittle — they tried two Postgres pools (one `SET SESSION CHARACTERISTICS AS TRANSACTION
  READ ONLY`) and **rejected it** because legitimate side-effect writes and cross-service context
  propagation made it messier than endpoint-level tagging. Conclusion: **enforce at the
  API/handler layer, not the DB layer**, for this use case.

**Why backend matters (one line):** the button text is not a security boundary; the request
path is. An admin (or a stolen admin token) can always call the API directly.

Sources:
- https://engineering.pigment.com/2026/04/08/safe-user-impersonation/
- https://agnitestudio.com/blog/admin-impersonation-saas-security/
- https://packetwanderer.com/posts/saas-support-admin-trust-boundaries/
- https://docs.nestjs.com/guards (guard = per-request authorization pattern)

---

## 5. Tenant/merchant switching UX for admins

From Pigment's UX section + general patterns:

- A small **impersonation widget** (sidebar) shows who/which merchant is being viewed and an
  end-session button (one click).
- **Switch directly** between merchants without ending the session first — fluid for debugging
  across accounts.
- **Strong, always-visible indicator** that you are in impersonation mode (Pigment uses a dark
  border around the entire screen) to prevent the admin confusing it with their own account.
- Show the app **exactly as the merchant sees it** — including edit buttons/menus — so the admin
  can verify what the merchant can/can't do. Writes are blocked by the backend; on rejection the
  UI shows "writes are blocked during impersonation."
- Custom "not found / no access" page during impersonation: "The impersonated merchant does not
  have access to this page" is often exactly the debugging info the admin needs.
- A merchant **picker/search** to select which tenant to enter (search must itself be tenant-
  scope-aware; per Agnitestudio, admin search that returns global data is a common leak).
- Optional polish: render UI in the admin's own locale while showing merchant data.

Smallest viable UX: a merchant selector (search by id/name/email) + a persistent banner/border
+ an "exit" button. UI-side read-only disabling of buttons is a nice-to-have on top of backend
enforcement, not a substitute.

Source: https://engineering.pigment.com/2026/04/08/safe-user-impersonation/

---

## 6. Security risks & KISS/DRY mitigations

Risks (from PacketWanderer, Agnitestudio, Bud Consulting, Pigment):

- **Accidental writes** while viewing -> mitigate with backend write-guard (section 4), default-
  deny mutations during impersonation.
- **Privilege escalation / tenant crossing** -> the viewed `merchantId` must be the enforced
  boundary on every request; re-check it server-side (don't trust client-supplied merchant id).
  Block impersonating *other platform admins* or escalating roles.
- **Missing/weak audit trail** -> log every session start/switch/end with `{actorAdminId,
  merchantId, timestamp, reason?}`. Because the actor id rides in the token, every action is
  double-attributed (merchant identity for data integrity + admin identity for accountability).
  Internal tools often have *weaker* logging than customer routes — don't fall into that trap.
- **Stale/forgotten sessions** -> short TTL (e.g. 30 min) auto-expiry; server-side revocation.
- **Direct-API abuse bypassing hidden UI** -> never gate solely in UI; the guard must be on the
  API. Re-validate `isPlatformAdmin` against the secret on the server each time.
- **Secret leakage** -> allow-list secret linked only to backend, never bundled to frontend.
- **Step-up auth (optional, higher-assurance)** -> some implementations require MFA/TOTP + a
  mandatory reason before starting (givernance, fullstackhero). Likely overkill for the smallest
  version but worth noting for compliance.

KISS/DRY ways to minimize impact surface:
- One server-derived `isPlatformAdmin` check (from the SST Secret allow-list) — single source.
- One write-guard middleware that default-denies mutations when `readOnly` is set — single
  enforcement point, every route inherits it (DRY).
- Carry impersonation context in the session/token, not scattered flags — services stay unaware.
- Default-deny: if endpoint classification is uncertain, treat it as a mutation and block.
- Keep the feature tiny: no role hierarchy, no per-permission grants — just
  "platform admin = read any merchant, write nothing."

Sources:
- https://packetwanderer.com/posts/saas-support-admin-trust-boundaries/
- https://agnitestudio.com/blog/support-admin-tenant-access-saas/
- https://bud.consulting/admin-impersonation-testing/
- https://github.com/purposestack/givernance/blob/main/docs/19-impersonation.md
- https://fullstackhero.net/docs/security/impersonation/

---

## Smallest viable design (recommended for this SST monorepo)

1. **Secret allow-list**: `new sst.Secret("PlatformAdminEmails")`, set via `sst secret set`,
   linked ONLY to the backend service. Read via `Resource.PlatformAdminEmails.value`, parse to
   a normalized lowercase array at cold start. Match on verified email (or stable user id).

2. **Derive `isPlatformAdmin` server-side** in the auth/session layer by checking the verified
   identity against the allow-list. Never accept it from the client.

3. **Enter merchant view**: an endpoint `POST /admin/impersonate { merchantId }` that requires
   `isPlatformAdmin`, then stamps the session (or mints a token) with
   `{ impersonation: { actorAdminId, merchantId, readOnly: true, exp: now+30m } }`. Log it.

4. **Backend write-guard middleware** on every request: if `impersonation.readOnly` and the
   request is a mutation -> `403` + `X-ReadOnly-Impersonation` header before any business logic.
   Default-deny unknown/mutating routes. (Add a build-time/test check that new mutating routes
   are covered if the API grows.)

5. **Tenant scoping**: all data reads use the `impersonation.merchantId` as the enforced tenant
   on the server; ignore any client-supplied tenant id.

6. **UX**: merchant search/picker to enter, a persistent "Viewing <merchant> (read-only)"
   banner/border, one-click exit, friendly toast when the backend blocks a write.

7. **Audit log**: append `{actorAdminId, merchantId, action, ts}` on session start/switch/end
   (and ideally on each blocked write attempt).

This delivers read-only merchant viewing with backend-guaranteed safety, a single secret as the
trust root, and minimal new surface area.