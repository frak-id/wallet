# apps/listener — Compass

Iframe RPC handler bridging partner-site SDK ↔ Frak Wallet. Single-view (no routing). Minimal bundle (iframe load time critical). Served at `/listener` path on wallet ingress — not standalone.

## Quick Commands
```bash
bun run dev          # Dev server
bun run build        # Production build
bun run bundle:check # Vite bundle visualizer — enforce minimal size
bun run test         # listener-unit Vitest project
```

## Key Files
- `app/entry.client.tsx` — iframe bootstrap
- `app/views/listener.tsx` — RPC setup (single view, no routing)
- `app/module/hooks/` — **14 RPC message handlers** (core logic, add new handlers here)
- `app/module/handlers/` — handler wrappers · `app/module/middleware/` — request/response middleware
- `app/module/{modal,embedded}/` — wallet UI rendered over partner site
- `app/module/stores/` — Zustand (modal + context state) · `app/module/providers/` — RootProvider (Wagmi, QueryClient)

## Non-Obvious Patterns
- **No routing**: single-view iframe; adding a route means rethinking the architecture.
- **Bundle size is a KPI**: avoid heavy deps; always run `bundle:check` before merging.
- **Served via wallet ingress**: path-based routing `/listener` — do NOT deploy as independent service.
- **postMessage security**: mock `window.origin` + `document.referrer` in tests (see `test-foundation/dom-mocks.ts`, `setupListenerDomMocks`).
- **Shared logic comes from `@frak-labs/wallet-shared`** (auth, smart wallet, sessions) — do not duplicate.
- **RPC protocol defined in `@frak-labs/frame-connector`** — adding a method also requires SDK schema updates in `sdk/core/src/types/rpc/` + `IFrameRpcSchema`.

## Anti-Patterns
Adding routes · heavy dependencies · bypassing `frame-connector` schema · deploying standalone.

## See Also
Parent `/AGENTS.md` · `apps/wallet/AGENTS.md` (shares ingress) · `packages/wallet-shared/AGENTS.md` · `packages/rpc/` (frame-connector) · `sdk/core/AGENTS.md` (RPC schema).
