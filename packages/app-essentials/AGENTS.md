# packages/app-essentials — Compass

Core blockchain config, ABIs, WebAuthn RP, and platform detection. Workspace-only (not published). Only runtime dep: `viem`. Consumed by backend (10×), business (7×), wallet (5×), wallet-shared (3×), listener (2×), sdk/components.

## Key Files
- `src/blockchain/abis/` — Viem-compatible ABIs: campaign, kernel, rewarder
- `src/blockchain/addresses.ts` — contract addresses + stablecoins (prod/testnet split)
- `src/blockchain/provider.ts` — `getViemClientFromChain()` (caching + multicall batching)
- `src/blockchain/transport/` — ERPC primary, DRPC fallback
- `src/blockchain/wallet.ts` — Kernel smart-wallet init code (WebAuthn + ECDSA)
- `src/blockchain/roles.ts` — product + validator roles
- `src/webauthn/index.ts` — `rpId`, `rpOrigin`, `rpAllowedOrigins` (env + Tauri aware)
- `src/utils/{env.ts, platform.ts, stringToBytes32.ts, currencyDetection.ts}`

## Key Exports
- **ABIs**: `campaignBankAbi`, `interactionCampaignAbi`, `referralCampaignAbi`, `KernelExecuteAbi`, `multiWebAuthNValidatorV2Abi`, `rewarderHubAbi`
- **Addresses**: `rewarderHub`, `campaignBankFactory`, `webAuthNValidator`, `usdcArbitrumAddress`, `currentStablecoins`
- **Utils**: `isRunningInProd`, `isRunningLocally`, `isTauri`, `isIOS`, `isAndroid`

## Non-Obvious Patterns
- **WebAuthn RP config is env+Tauri driven**: `WEBAUTHN_RP_ID`, `FRAK_WALLET_URL`, and `isTauri` resolve the effective RP. Tests must pin these or RP mismatch is silent.
- **Transport has a fallback chain**: ERPC → DRPC; do not bypass to raw HTTP or you lose resilience.
- **Multi-chain ready**: Arbitrum, Arbitrum Sepolia wired. Base/Polygon declared in wagmi configs (see `packages/wallet-shared`).
- **Subpath exports**: `./blockchain`, `./utils/env`, `./utils/platform` — import from the right subpath, not the root barrel, to keep tree-shaking effective.
- **Don't hardcode chain IDs or addresses** anywhere else — this package is the single source.

## Anti-Patterns
Hardcoding addresses/chain IDs · creating Viem clients directly (`new PublicClient(...)`) · hardcoded `rpId` · bypassing ERPC→DRPC fallback · publishing to npm (workspace-only).

## See Also
Parent `packages/AGENTS.md` · `services/backend/` (primary consumer) · `apps/wallet/` · `packages/wallet-shared/`.
