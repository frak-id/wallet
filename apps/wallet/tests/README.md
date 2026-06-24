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

# a single project / file / title
bunx playwright test --project=sdk-fresh
bunx playwright test --project=setup
bunx playwright test specs/home/all.spec.ts
bunx playwright test -g "should log in via passkey"

# UI mode, last report, last trace
bun run test:e2e:ui
bun run test:e2e:report
```

`TARGET_ENV` selects the base URL (`local` → `https://localhost:3000`).
`FRAK_E2E_HOST_URL` is the partner page the SDK specs load (defaults to the
deployed vanilla demo; set it to `http://localhost:3013/` for a local run).

## Architecture

### Projects (`playwright.config.ts`)

| Project | Depends on | Storage | Purpose |
|---|---|---|---|
| `setup` | – | writes `ON_DEVICE_STORAGE_STATE` | Register/login a mocked on-device wallet |
| `setup-paired` | – | writes `PAIRED_STORAGE_STATE` | Cross-device (distant-webauthn) pairing |
| `chromium-on-device` | `setup` | on-device state | Authenticated wallet specs (home, history, settings) — **mobile** (Pixel 7), excludes sdk |
| `chromium-paired` | `setup-paired` | paired state | Wallet specs under a paired session — desktop |
| `sdk-embedded` | `setup` | on-device state | Authenticated SDK/modal specs (sdk/all, sdk/balance-all) — desktop partner page |
| `sdk-fresh` | – | none | Logged-out, **self-contained** SDK modal/login specs — desktop |

The setup projects run first and persist a Playwright storage state under
`playwright/.storage/`; the authenticated projects load it via `storageState`.
`setup` and `setup-paired` are split so the (flaky) pairing flow only gates the
paired suite — never the on-device path.

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

## Layout

```
tests/
├── fixtures.ts              # Playwright fixtures (pages, helpers, api)
├── global.setup.ts          # on-device setup → ON_DEVICE_STORAGE_STATE
├── global-paired.setup.ts   # pairing setup → PAIRED_STORAGE_STATE
├── api/                     # backend.api (route/WS mocks, mockLoginSuccess), rpc.api, analytics.api
├── helpers/                 # mockedWebauthn, webauthn (virtual), sdk, pairingTab, clipboard, storage
│   └── webauthn/            # hand-rolled attestation/assertion (signature.ts) + types
├── pages/                   # auth, home, history, settings, pairing, modal page objects
└── specs/
    ├── authentication/      # on-device-login/register, pairing-desktop
    ├── home/ history/ settings/
    └── sdk/                 # embedded wallet (all, balance-all) + modal-*-fresh
```

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

## Adding a spec

1. Pick the project by auth need: `sdk-fresh` (logged-out / self-contained),
   `chromium-on-device` (authenticated wallet, mobile), `chromium-paired`
   (distant-webauthn), `sdk-embedded` (authenticated SDK).
2. Reuse page objects + helpers; add new ones to `fixtures.ts`.
3. Name on-device files `*on-device*.spec.ts` or `*all*.spec.ts`, pairing
   `*pairing*.spec.ts`, and self-contained modal files `*fresh*.spec.ts` so they
   land in the right project (`testMatch`).
