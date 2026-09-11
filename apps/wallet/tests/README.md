# Frak Wallet E2E (Playwright)

End-to-end tests for the wallet app and the SDK → listener-iframe modal flows.
Auth is **pure WebAuthn** (biometrics, no passwords). Because every protected
view needs an authenticated session, the suite is built around **setup projects
that produce reusable storage states**.

> ⚠️ Not currently run in CI. Treat green/red as a local signal and keep
> selectors in sync with the app — the UI drifts.

## Prerequisites (local)

Most specs talk to the real backend, so the local stack must be running. Start
the SST dev multiplexer from the repo root:

```bash
bun run dev   # SST multiplexer: wallet + listener + backend + example sites
```

The **vanilla partner harness** (needed by the SDK / modal specs) is part of the
multiplexer but has `autostart: false` — **start it manually in the multiplexer**
(`infra/example.ts`). It then serves on <http://localhost:3013>.

The backend must be reachable and migrated (`bun -F @frak-labs/bootstrap start`
once if it's a fresh DB).

## Running

```bash
cd apps/wallet

# local stack (default TARGET_ENV=local). On-device + auth specs.
bun run test:e2e

# local stack + local vanilla host (needed for the SDK/modal specs)
bun run test:e2e:local      # FRAK_E2E_HOST_URL=http://localhost:3013/

# remote environments
bun run test:e2e:dev        # wallet-dev.frak.id
bun run test:e2e:prod       # wallet.frak.id  (careful)

# two-wallet referral chain (real backend, no route mocks)
bun run test:e2e:sharing        # dev — the default target
bun run test:e2e:sharing:local  # local stack, when offline

# a single project / file / title
bunx playwright test --project=sdk-fresh
bunx playwright test --project=setup
bunx playwright test specs/home/all.spec.ts
bunx playwright test -g "should log in via passkey"

# UI mode, last report, last trace
bun run test:e2e:ui
bun run test:e2e:report
```

`TARGET_ENV` selects the base URL (`local` → `https://localhost:3000`), and now
also the backend and merchant harness the `sharing-referral` project probes:

| `TARGET_ENV` | Wallet | Backend | Harness |
|---|---|---|---|
| `dev` (default) | `wallet-dev.frak.id` | `backend.gcp-dev.frak.id` | `vanilla.frak-labs.com` |
| `prod` | `wallet.frak.id` | `backend.frak.id` | `vanilla.frak-labs.com` |
| `local` | `localhost:3000` | `localhost:3030` | `localhost:3013` |

`FRAK_E2E_HOST_URL` overrides the harness column for any target.

## Architecture

### Projects (`playwright.config.ts`)

| Project | Depends on | Storage | Purpose |
|---|---|---|---|
| `setup` | – | writes `ON_DEVICE_STORAGE_STATE` | Register/login a mocked on-device wallet |
| `setup-paired` | – | writes `PAIRED_STORAGE_STATE` | Cross-device (distant-webauthn) pairing |
| `chromium-on-device` | `setup` | on-device state | Authenticated wallet specs (home, history, settings) — **mobile** (Pixel 7), excludes sdk |
| `chromium-paired` | `setup-paired` | paired state | Wallet specs under a paired session — desktop |
| `sdk-fresh` | – | none | Logged-out, **self-contained** SDK modal/login specs — desktop |
| `sharing-referral` | – | none | Two-wallet referral chain against a real backend — desktop, serial |

The setup projects run first and persist a Playwright storage state under
`playwright/.storage/`; the authenticated projects load it via `storageState`.
`setup` and `setup-paired` are split so the (flaky) pairing flow only gates the
paired suite — never the on-device path.

`sharing-referral` registers its own referrer inside the suite, so it depends on
no setup project. It is deliberately serial: the negative assertions (no
self-referral attribution, second referrer loses) are only meaningful once the
earned-referral spec has proven this environment emits an arrival at all. A
listener that distrusts the harness origin refuses every interaction silently,
which is indistinguishable from a passing negative assertion — hence the
precondition guard in `helpers/stack.helper.ts`.

### WebAuthn

Two mechanisms exist — know which a spec uses:

- **Mocked** (`helpers/mockedWebauthn.helper.ts` + `helpers/webauthn/`):
  overrides `navigator.credentials.create/get` with a hand-rolled P-256
  authenticator. Used by `global.setup.ts`. The persisted keypair lives in
  `playwright/.storage/authenticator-<env>.json`.
  - This mock **must** satisfy the backend's `@simplewebauthn/server` verifier.
    Hard-won invariants (see `webauthn/signature.ts`): `getPublicKey()` returns
    DER **SPKI**; `toJSON()` returns a full `RegistrationResponseJSON`; the
    attestation signature and COSE key x/y are CBOR **byte strings** (a raw
    `Uint8Array` becomes a tagged typed array node-cbor emits but the verifier
    can't read); sign with a **single** SHA-256 (`prehash`), not pre-hash + sign.
- **Virtual authenticator** (`helpers/webauthn.helper.ts`): Chrome's native
  CDP `WebAuthn.addVirtualAuthenticator` (real crypto). Used by some
  authentication specs.

### SDK / listener modal specs (`specs/sdk/*-fresh.spec.ts`)

Run in `sdk-fresh` and are **self-contained** — no `setup` dependency:

- WebAuthn is mocked client-side (`mockedWebAuthN`).
- `/auth/login` is stubbed with a canned session (`backendApi.mockLoginSuccess`).
- They load the partner page (`FRAK_E2E_HOST_URL`), boot the real SDK, and drive
  the listener iframe (`#frak-wallet`) via `pages/modal.page.ts`.
- Selectors use the stable `nexus-modal-*` class hooks — the listener can render
  raw i18n keys before translations load locally, so text selectors are unsafe.

### Sharing referral specs (`specs/sharing/*.spec.ts`)

Run in `sharing-referral` against a real backend with **no route mocking** — a
mocked arrival would prove nothing about the `referral_links` row. A referrer
registers on the wallet origin, opens the SDK sharing modal on the merchant
page, and its link is captured from the clipboard; a fresh anonymous context
consumes it. Assertions read the arrival response body and a direct `fetch` to
`/user/merchant/referral-status`, never `frak_getUserReferralStatus` (cached at
three layers, so a dropped row would still read `isReferred: true`).

Four files, run in path order because the later ones assert absences:

| File | Asserts |
|---|---|
| `fixtures.spec.ts` | The environment is usable and the fixtures are what they claim: link carries the referrer wallet, two credential names are two wallets, each referee is a new identity |
| `referral-earned.spec.ts` | **Positive control.** An arrival returns a `referralLinkId` and the referee reads as referred |
| `referral-rules.spec.ts` | Self-referral resolves `"self-referral"` and emits nothing; the second referrer's arrival returns no id while the first's did |
| `referral-merge.spec.ts` | Wallet-only read is `false` before the ensure and `true` after, the ensure reports `linked`, and the same call unsigned is refused 403 `PROOF_REQUIRED` |

Two traps are worth knowing before editing them. `POST /user/track/interaction`
carries `sharing` and `custom` interactions too — the copy action alone posts a
`sharing` one — so the arrival capture filters on the request's `type`; without
it a self-referral looks like an attributed arrival that merely lost its id.
And the SDK fires `ensureIdentity` during its own boot, latching a
`sessionStorage` key, so the merge spec arms its interception and takes its
pre-merge baseline *before* returning to the merchant page rather than racing
that call.

**Local target needs a merchant precondition.** The SDK resolves the merchant by
bare `window.location.hostname` (`localhost`) while the listener compares the
iframe origin's `host` (`localhost:3013`, port included). Unless the merchant
resolved for `localhost` carries `localhost:3013` in `allowedDomains`, the
listener drops to `dev-override` and refuses every interaction with `-32002`.
The dashboard route rejects a port, so set it at registration
(`services/backend/src/domain/merchant/services/MerchantRegistrationService.ts`
accepts `allowedDomains` unvalidated) or by a seed. `assertStackReady` fails
naming the exact missing entry. Dev needs nothing: `vanilla.frak-labs.com`
resolves a merchant that already allows it.

## Layout

`fixtures.ts` wires the page objects, helpers and API mocks into the Playwright
fixture bag; `global.setup.ts` / `global-paired.setup.ts` produce the two storage
states the projects above consume. Everything else is `ls`: `api/`, `helpers/`
(with the hand-rolled WebAuthn attestation/assertion under `helpers/webauthn/`),
`pages/` and `specs/`.

## Gotchas (learned the hard way)

- **Mocked WebAuthn ↔ backend**: the mock must produce attestations/assertions
  the real backend verifies. If register 500s or login returns "Invalid
  signature", debug `webauthn/signature.ts` against `@simplewebauthn` (see the
  invariants above).
- **`networkidle` never settles on `/wallet`** (live sockets + polling). Wait on
  the URL, not `networkidle`.
- **Use auto-waiting assertions** (`expect(locator).toBeVisible()`), not one-shot
  `locator.isVisible()`, which races SPA render.
- **Modal selectors**: prefer `nexus-modal-*` classes / `aria-label` over text;
  the listener may show raw i18n keys locally.
- **Pairing socket is service-worker-driven** → WS routing must be at the
  **context** level (`page.context().routeWebSocket`); capture is still flaky.
- **Stale storage**: if auth behaves oddly, delete `playwright/.storage/*` to
  force a fresh credential + re-register.
- **Zero arrivals is not a passing negative**: a listener that distrusts the
  harness origin emits no interaction request at all, and both SDK layers
  swallow the refusal. Run the earned-referral spec first as the positive
  control before trusting any "no attribution" assertion.

## Adding a spec

1. Pick the project by auth need: `sdk-fresh` (logged-out / self-contained),
   `chromium-on-device` (authenticated wallet, mobile), `chromium-paired`
   (distant-webauthn), `sharing-referral` (two contexts, real backend).
2. Reuse page objects + helpers; add new ones to `fixtures.ts`.
3. Name on-device files `*on-device*.spec.ts` or `*all*.spec.ts`, pairing
   `*pairing*.spec.ts`, self-contained modal files `*fresh*.spec.ts`, and
   referral files under `specs/sharing/` so they land in the right project
   (`testMatch`).
