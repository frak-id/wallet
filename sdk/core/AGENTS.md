# sdk/core — Compass

Framework-agnostic core SDK (111 public exports). Dual build: NPM (`dist/`, ESM+CJS+types) and CDN (`cdn/bundle.js`, IIFE, `window.FrakSDK`).

## Key Files
- `src/index.ts` — main barrel
- `src/actions/` — 14 actions: `displayModal`, `displayEmbeddedWallet`, `sendInteraction`, `sendTransaction`, `watchWalletStatus`, `getMerchantInformation`, `openSso`, `prepareSso`, `processReferral`, `referralInteraction`, `trackPurchaseStatus`, `modalBuilder`, `siweAuthenticate` (+ `index.ts`)
- `src/clients/` — `createIFrameFrakClient`, `setupClient`, iframe communication, `DebugInfoGatherer`
- `src/types/rpc/` — `IFrameRpcSchema` + per-method types
- `src/bundle.ts` — CDN entry (IIFE)
- `src/utils/` — compression (`compressJsonToB64`), base64url, URL builders, `sdkConfigStore`, `FrakContextManager`

## Subpath Exports
`.`, `./actions`, `./bundle`. Browser field → `./cdn/bundle.js`. `development` condition → `./src/index.ts` (monorepo dev).

## Defined Variables (tsdown)
`OPEN_PANEL_API_URL`, `SDK_VERSION` — injected at build time; not read from runtime env.

## Non-Obvious Patterns
- **Framework-agnostic rule**: NO React/Preact/Vue code here — that belongs in `sdk/react` or `sdk/components`.
- **Pure actions**: no side effects outside `client.request`. Tree-shakeable named exports only.
- **Adding an action requires schema update**: always extend `IFrameRpcSchema` first, or the RPC is not typed end-to-end.
- **CDN bundle is `noExternal: [/.*/]`**: viem + all deps inline. Be conscious of size on every change.
- **Client is singleton per iframe**: prefer `setupClient` once; don't instantiate repeatedly.

## See Also
Parent `sdk/AGENTS.md` · `sdk/react/AGENTS.md` (hook wrappers) · `sdk/components/AGENTS.md` · `packages/rpc/` (transport) · `apps/listener/` (iframe endpoint).
