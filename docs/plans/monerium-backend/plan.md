# Monerium: move the integration server-side

Status: in progress on `feat/monerium-backend` (2026-10-15). Tracks FRA-258 and FRA-361.

Goal: the Monerium OAuth tokens and every Monerium API call move from the wallet
(localStorage + `/monerium-api` nginx proxy) to `services/backend`, which is what
Monerium's OAuth guide requires ("bearer tokens must be kept server-side"), and the
move is used to ship the best end-user UX we can on the OAuth plan.

## Contract (already in the tree — do not change without telling the parent)

- Shared rules: `packages/app-essentials/src/monerium/index.ts`
  (`@frak-labs/app-essentials/monerium`): redeem message builder/parser, IBAN
  mod-97, amount/memo/name/country rules, limits, linking message. The wallet
  builds the message the user signs with it; the backend validates with it.
- Route schemas: `services/backend/src/domain/monerium/schemas/index.ts`
  (incl. `moneriumErrorCodes`).
- Routes (stubs to implement): `services/backend/src/api/user/wallet/monerium/index.ts`,
  mounted at `/user/wallet/monerium`, all `withWalletAuthent`. Wallet side:
  `authenticatedWalletApi.monerium.*`.

| Route | Purpose |
|---|---|
| `GET /status?refresh=` | connection, profile, walletLink, silentReconnect, environment |
| `POST /auth/start` | returns the Monerium portal URL (PKCE held server-side) |
| `POST /auth/callback` | `{code,state}` from the wallet callback route → tokens stored → status |
| `POST /auth/siwe/prepare` | returns `{state, message}` (EIP-4361) for the wallet to sign |
| `POST /auth/siwe` | `{state, signature}` → silent reconnect → status, or 422 `MONERIUM_SIWE_REJECTED` |
| `DELETE /connection` | forget everything Frak holds for this wallet |
| `POST /wallet/link` | `{signature}` of `MONERIUM_ADDRESS_LINKING_MESSAGE` |
| `GET /orders` | orders of the session wallet (flattened DTO) |
| `POST /orders` | idempotent redeem (client UUID), own or third-party payout |
| `GET /beneficiaries` | past payout counterparts derived from Monerium orders, never stored |

## Backend decisions

1. **Keyed by the smart-account address** (`walletSession.address`). The same passkey
   yields the same address on every device, so "connect once, use everywhere" holds.
2. **Tokens encrypted at rest**, AES-256-GCM, key from
   `AdminWalletsRepository.deriveKeyBytes("monerium-token-encryption")` (the
   `TotpService` pattern). Never returned to a client, never logged.
3. **Refresh under a row lock**: `SELECT … FOR UPDATE` in a transaction, re-check expiry
   after the lock (another pod may have refreshed), 60 s grace, persist the rotated
   refresh token in the same transaction. `invalid_grant` → connection
   `reauth_required` (tokens wiped, profile/link cache kept for SIWE eligibility).
4. **Hand-written typed HTTP client** (no `@monerium/sdk`): SIWE needs
   `redirect: "manual"` + `Location` parsing, `POST /orders` and `POST /addresses` can
   answer 202, and 429 needs `Retry-After`. Hosts `api.monerium.app` (prod,
   `isRunningInProd`) / `api.monerium.dev`; `Accept: application/vnd.monerium.api-v2+json`;
   chain `arbitrum` / `arbitrumsepolia`.
5. **OAuth start** params: `client_id`, `redirect_uri` = `${FRAK_WALLET_URL}/monerium/callback`,
   `response_type=code`, PKCE S256, `state`, optional `auth_mode`, `skip_kyc=true` in
   sandbox only. The undocumented `address`/`signature=0x`/`chain` auto-link is dropped.
6. **Pending auth** rows are single-use, bound to the session wallet, 30 min TTL.
7. **SIWE silent reconnect** (to be validated in sandbox, falls back to the portal):
   viem `createSiweMessage` — domain = wallet host, address = wallet, statement
   `Allow Frak Wallet to access my data on Monerium`, uri = redirect URI, version 1,
   chainId 42161 / 421614, `generateSiweNonce()`, expiration +10 min, resources
   `https://monerium.com/siwe`, `https://frak.id/privacy`, `https://frak.id/terms`.
   Submit = `POST /auth` form with `authentication_method=siwe`, `redirect: "manual"`,
   code read from `Location`. A rejection sets `siwe_failed_at` so we never ask that
   wallet for a pointless passkey prompt again, logs Monerium's answer at `warn`, and
   returns 422. `silentReconnect = reauth_required && walletLink == linked &&
   !siwe_failed_at && MONERIUM_SIWE_ENABLED != "false"`.
8. **Status** serves the DB cache and refreshes from Monerium when `refresh=true` or the
   cache is older than 60 s; if Monerium is down, the cache is returned.
9. **Orders** validated with the shared helpers: message must parse, its amount and
   shortened IBAN must equal the body's, timestamp within [now − 5 min, now + 10 min];
   memo 5–140 or `MONERIUM_DEFAULT_MEMO`; names ≥ 2, ISO alpha-2 country for
   third-party; the 15 000 EUR cap applies to third-party payouts only (own payouts are
   exempt per Monerium). The order `id` is the client UUID; a retry with a known id
   returns the existing order. Upstream 202 → `order: null`.
10. **Tracked orders** store only id, wallet, amount, state — no IBAN, no names.
11. **Sync job** (`MutexCron` → orchestrator, since it spans monerium + notifications):
    in-flight orders, non-terminal profiles and pending wallet links, bounded by age and
    last check, stops for the tick on 429. Localised push on order processed/rejected and
    profile approved/rejected; no IBAN or name on the lock screen;
    `data.url = ${FRAK_WALLET_URL}/wallet?open=monerium`.
12. **Beneficiaries** derived on request from the wallet's redeem orders, unique by IBAN,
    newest first, never persisted or logged.
13. `MONERIUM_CLIENT_ID` moves from the wallet build to the backend env (same SST secret).

### Tables (schema in code; the migration is written by the DB owner)

- `monerium_connections` — PK wallet; Monerium user id, profile id/kind/state/reasonCode,
  wallet link state, status (`connected` | `reauth_required`), encrypted access token +
  expiry, encrypted refresh token, `siwe_failed_at`, `state_checked_at`, timestamps.
- `monerium_pending_auths` — PK state; wallet, method (`oauth` | `siwe`), encrypted PKCE
  verifier, SIWE message, `expires_at`, `created_at`.
- `monerium_tracked_orders` — PK order id (uuid); wallet, amount, state,
  `last_checked_at`, timestamps.

## Wallet decisions

1. One `GET /status` query drives the flow; polls every 30 s while a profile or a link is
   pending and the sheet is open; "Check again" forces `refresh=true`.
2. Connect: `silentReconnect` → SIWE (prepare → sign → submit); any failure → analytics +
   portal (`/auth/start` → `window.location` / `openExternalUrl` on Tauri).
3. Callback route forwards `{code,state}` to the backend; `error` → cancelled screen; the
   deep-link resolver forwards `error` too.
4. Screens per state: none → info; reauth → reconnect; created/incomplete → finish on
   Monerium; pending/review → "verification in progress" with push opt-in and "Check
   again"; rejected/closed → blocked screen; approved + unlinked → link; link pending →
   waiting; linked → success once → transfer. No sandbox KYC bypass (sandbox sends
   `skip_kyc`).
5. Offramp: `normalizeRedeemAmount`, `buildRedeemOrderMessage` signed 2 min ahead, one
   `crypto.randomUUID()` per recap screen reused on retry, invalidate orders + status.
6. IBAN form: mod-97, names ≥ 2, country defaulting to the IBAN's, "This is my own
   account" (own payout: no names, no 15 000 cap).
7. Saved IBANs stay on the device. A one-off sync per (device, wallet) merges
   `GET /beneficiaries` into the local store (local entries win). Logout wipes both
   Monerium stores; the server connection survives logout by design.
8. `moneriumStore` keeps UI state only; a persist migration purges the old tokens.
9. One `isMoneriumEnabled` flag gates TransferModal, ProfilePage, the callback route and
   the push deep link.
10. Removed: `moneriumApi.ts`, `moneriumTypes.ts`, client PKCE, the `MONERIUM_CLIENT_ID`
    define, the nginx `/monerium-api/` location + envsubst, Dockerfile args, the vite dev
    proxy, the Tauri CSP entries, the wallet's `MONERIUM_*` env in `infra/gcp/wallet.ts`.

## Open after merge

- Validate SIWE with a smart-account (ERC-1271) signature in sandbox. If Monerium rejects
  it, set `MONERIUM_SIWE_ENABLED=false`; the portal fallback already covers it.
- Wallet merge: the loser wallet's connection is not migrated (needs a re-link on the
  winner address at Monerium anyway).
- DB migration for the three tables.

## Implementation notes (wallet lane)

- Wallet types come from `@backend-domain/monerium/schemas` (type-only imports, erased at build); no backend runtime code reaches the wallet bundle. The `MoneriumErrorCode` union drives an exhaustive code → i18n key map in `moneriumErrors.ts`.
- Backend contract assumptions: error bodies carry `code` (`t.ErrorResponse`); `GET /status?refresh=true` bypasses the 60 s cache; `POST /auth/siwe` returns the status DTO; `POST /orders` memo omitted when empty.
- Push link: `data.url = ${FRAK_WALLET_URL}/wallet?open=monerium`. Web: the service worker opens/navigates to it and the `/wallet` route opens the bank flow once, then strips `open`. Tauri: the deep-link resolver forwards `open=monerium` for `wallet` links, but the `frak-firebase` plugin has no notification-tap handler that opens `data.url`, so a tap on mobile does not navigate yet (native change, out of this lane).
- Persisted state: `frak_monerium_store` v2 (UI flag only; v1 tokens purged by `migrate`), `frak_iban_store` v1 (`own`, `country`, `syncedWallet`). Both keys are removed on logout.
- Removed wallet env: `MONERIUM_CLIENT_ID` (vite define, Dockerfile, `infra/gcp/wallet.ts`), `MONERIUM_API_HOST`, nginx `/monerium-api/` and its CORS map. The wallet nginx.conf is now copied to `conf.d/default.conf` (no envsubst).
- The recap memo is no longer pre-filled with the beneficiary label; empty means `MONERIUM_DEFAULT_MEMO` server-side.
