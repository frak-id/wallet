# packages/ — Compass

Shared workspace packages. Workspace protocol (`workspace:*`). Most are source-only (consumed via `development` export condition); only `rpc` has a public NPM build.

## Quick Commands
```bash
bun run test --project wallet-shared-unit   # or wallet-unit, business-unit, core-sdk-unit, ...
bun run typecheck                           # runs across all packages from root
```

## Package Matrix
| Package | Purpose | Consumers (workspace) |
|---------|---------|------------------------|
| `wallet-shared` | Shared state/flows (auth, smart wallet, pairing) | wallet, listener ONLY |
| `design-system` | Vanilla Extract tokens + 28 components + Box | wallet, sdk/components |
| `ui` | Radix + CSS Modules (legacy, being replaced) | business, shopify |
| `app-essentials` | ABIs, addresses, viem provider, WebAuthn RP | backend, business, wallet, listener, wallet-shared, sdk/components |
| `rpc` (published as `@frak-labs/frame-connector`) | Iframe/postMessage RPC | all SDKs, listener |
| `client` | Elysia Eden Treaty client | wallet, business, shopify |
| `dev-tooling` | Centralised Vite + Lightning CSS configs | business, listener, sdk/legacy |
| `test-foundation` | Vitest shared config + mocks + fixtures | all 10 Vitest projects |
| `ui-preview` | Embedded preview widgets | business, shopify |

## Non-Obvious Patterns
- **`wallet-shared` scope rule**: STRICTLY wallet+listener. Not business/backend/shopify. AlertDialog is knowingly duplicated with `packages/ui`.
- **`ui` is deprecated**: do not add components; migrate consumers to `design-system`.
- **`development` export condition** everywhere: apps use `src/index.ts` directly in dev — no build step needed in the monorepo.
- **Subpath exports are explicit**: wildcard re-exports forbidden. Public API is locked per-package.
- **`test-foundation` setup order matters**: `shared-setup → react-setup → RTL → wallet-mocks → apps-setup → project-setup`. Breaking the order breaks hoisting-safe mocks.
- **`app-essentials` is workspace-only** (not published). Only runtime dep: `viem`.
- **Lightning CSS targets** (for CSS Modules apps) are centralised in `dev-tooling` — Chrome 100+, Safari 14+, Firefox 91+, Edge 100+.
- **Zustand rule**: individual selectors mandatory everywhere.

## Anti-Patterns
Adding to `packages/ui` · importing `wallet-shared` from business/backend/shopify · wildcard exports · hardcoded chain IDs/addresses (use `app-essentials`) · creating new Vitest configs (extend `test-foundation/vitest.shared`).

## See Also
Parent `/AGENTS.md` · children `packages/{wallet-shared,design-system,ui,app-essentials,test-foundation}/AGENTS.md` · `sdk/AGENTS.md`.
