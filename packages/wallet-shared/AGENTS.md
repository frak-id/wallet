# packages/wallet-shared — Compass

Shared state/flows for **wallet + listener ONLY** (enforced by convention). 201 files, 15 domains. Used 153× in wallet, 75× in listener.

## Key Files
- `src/stores/` — Zustand: `sessionStore`, `walletStore`, `authenticationStore`, `clientIdStore` (all with `persist` middleware)
- `src/authentication/` — WebAuthn flows (ox/WebAuthnP256)
- `src/wallet/smartWallet/` — ERC-4337 kernel smart wallet logic
- `src/pairing/` — WebSocket + signature device pairing
- `src/providers/FrakContext.tsx` — SDK integration context
- `src/i18n/` — react-i18next (wallet + listener consume these translations)
- `src/test/factories.ts` — `createMockSession`, `createMockAddress`, etc.

## Non-Obvious Patterns
- **Scope enforcement is cultural, not technical**: do NOT add to business/backend/shopify imports. Violations have happened before.
- **Zustand selector rule is non-negotiable**: `store((s) => s.field)` — destructuring whole store is an outage in the wallet app.
- **`idb-keyval` not `idb`**: ~1.73 KB gzipped, works inside service worker context. Heavy IDB wrappers break the SW bundle.
- **BigInt serialization polyfill**: required by Zustand `persist`; lives in `test-foundation/react-setup.ts` for tests, present in app entrypoints.
- **Barrel from package root only**: `import { ... } from "@frak-labs/wallet-shared"` — internal paths discouraged.
- **Known duplication**: `AlertDialog` exists here and in `packages/ui`; pick based on app context (wallet uses this one).

## Anti-Patterns
Importing in business/backend/shopify · entire-store subscriptions · heavy IDB libs · internal-path imports.

## See Also
Parent `packages/AGENTS.md` · `apps/wallet/AGENTS.md` · `apps/listener/AGENTS.md` · `packages/app-essentials/AGENTS.md` (ABIs, WebAuthn RP).
