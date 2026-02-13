# packages/app-essentials

Core blockchain configuration, WebAuthn setup, and platform utilities. Shared across all apps and backend.

## Structure

```
src/
├── blockchain/
│   ├── abis/           # Viem-compatible contract ABIs (campaign, kernel, rewarder)
│   ├── transport/      # RPC transports (ERPC fallback to DRPC)
│   ├── addresses.ts    # Contract addresses, stablecoins (prod/testnet)
│   ├── provider.ts     # Viem client factory (caching + multicall batching)
│   ├── wallet.ts       # Kernel smart wallet init code (WebAuthn + ECDSA)
│   ├── roles.ts        # Product roles, validator roles
│   └── index.ts        # Barrel export
├── webauthn/
│   └── index.ts        # RP config (rpId, rpOrigin, allowed origins)
├── utils/
│   ├── env.ts          # isRunningInProd, isRunningLocally
│   ├── platform.ts     # isTauri, isIOS, isAndroid
│   ├── stringToBytes32.ts
│   └── currencyDetection.ts
└── index.ts            # Barrel export
```

## Where to Look

| Task | Location |
|------|----------|
| Contract ABIs | `src/blockchain/abis/` |
| Contract addresses | `src/blockchain/addresses.ts` |
| Viem client setup | `src/blockchain/provider.ts` |
| Smart wallet init | `src/blockchain/wallet.ts` |
| WebAuthn RP config | `src/webauthn/index.ts` |
| Environment detection | `src/utils/env.ts`, `src/utils/platform.ts` |

## Key Exports

- **ABIs**: campaignBankAbi, interactionCampaignAbi, referralCampaignAbi, KernelExecuteAbi, multiWebAuthNValidatorV2Abi, rewarderHubAbi
- **Addresses**: rewarderHub, campaignBankFactory, webAuthNValidator, usdcArbitrumAddress, currentStablecoins
- **Provider**: `getViemClientFromChain()`, `getTransport()`
- **WebAuthn**: rpId, rpOrigin, rpAllowedOrigins (env-aware: prod/dev/Tauri)
- **Utils**: isRunningInProd, isRunningLocally, isTauri, isIOS, isAndroid

## Conventions

- **Environment-aware**: WebAuthn RP config resolves from WEBAUTHN_RP_ID, FRAK_WALLET_URL, Tauri detection
- **Fallback transports**: ERPC primary, DRPC fallback (resilient RPC)
- **Multi-chain**: Supports Arbitrum, Arbitrum Sepolia via transport config
- **Subpath exports**: `./blockchain`, `./utils/env`, `./utils/platform`

## Anti-Patterns

- Hardcoding chain IDs or contract addresses (use exports from here)
- Creating Viem clients directly (use `getViemClientFromChain()`)
- Hardcoding WebAuthn RP ID (use `WebAuthN.rpId`)

## Notes

- Workspace-only package (not published to npm)
- Only dependency: `viem`
- Consumed by: backend (10), business (7), wallet (5), wallet-shared (3), listener (2)
