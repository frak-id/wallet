# packages/app-essentials — Compass

Core blockchain config, ABIs, WebAuthn RP, and platform detection. Workspace-only (not published). Only runtime dep: `viem`. Consumed by backend, business, wallet, wallet-shared, listener, sdk/components.

## Key Files
- `src/blockchain/abis/` — Viem-compatible ABIs: campaign, kernel, rewarder
- `src/blockchain/addresses.ts` — contract addresses + stablecoins (prod/testnet split)
- `src/blockchain/provider.ts` — `getViemClientFromChain()` (caching + multicall batching)
- `src/blockchain/transport/` — ERPC primary, DRPC fallback
- `src/blockchain/wallet.ts` — Kernel smart-wallet init code (WebAuthn + ECDSA)
- `src/webauthn/index.ts` — `WebAuthN.{rpId, rpOrigin, rpAllowedOrigins, androidApkOrigin}` (env + Tauri aware)
- `src/utils/{env.ts, platform.ts, currencyDetection.ts, url.ts, email.ts}`
- `src/constants/` — values a frontend and the backend must agree on byte-for-byte: `installTicket`, `emailVerification`, `rewards`, `serverMintedId`

The exhaustive export list lives in `src/index.ts` and the subpath barrels — read those rather than a copy here.

## Non-Obvious Patterns
- **WebAuthn RP config is env+Tauri driven**: `WEBAUTHN_RP_ID`, `FRAK_WALLET_URL`, and `isTauri` resolve the effective RP. Tests must pin these or RP mismatch is silent.
- **Transport has a fallback chain**: ERPC → DRPC; do not bypass to raw HTTP or you lose resilience.
- **Two chains, both always bound**: `frakChainIds` is Arbitrum One + Arbitrum Sepolia, and every authenticator is bound to both (the binding table is shared across environments).
- **Subpath exports**: `./blockchain`, `./utils/env`, `./utils/platform`, `./constants/*` — import from the right subpath, not the root barrel, to keep tree-shaking effective. A new file under `src/constants/` needs a matching `exports` entry in `package.json` or consumers cannot reach it.
- **`src/constants/` is the seam for cross-tree values**: the backend depends on this package (`workspace:*`), so a constant both sides must agree on lives here rather than being duplicated. `SERVER_MINTED_ID_PREFIX` is frozen by a SQL `LIKE` predicate and rows already written; `INSTALL_TICKET_TTL_MS` is compiled into store binaries.
- **Don't hardcode chain IDs or addresses** anywhere else — this package is the single source.

## Anti-Patterns
Hardcoding addresses/chain IDs · creating Viem clients directly (`new PublicClient(...)`) · hardcoded `rpId` · bypassing ERPC→DRPC fallback · publishing to npm (workspace-only).

## See Also
Parent `packages/AGENTS.md` · `services/backend/` (primary consumer) · `apps/wallet/` · `packages/wallet-shared/`.
