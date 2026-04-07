# Shared Packages Context

## Package Overview

| Package | Purpose |
|---------|---------|
| `wallet-shared` | Shared code for wallet + listener ONLY |
| `design-system` | Vanilla Extract design system (replaces ui) |
| `ui` | Radix-based component library (being replaced by design-system) |
| `app-essentials` | Core blockchain + WebAuthn config |
| `client` | Elysia Eden Treaty API client |
| `dev-tooling` | Vite configs, Lightning CSS |
| `rpc` | Published as @frak-labs/frame-connector |
| `test-foundation` | Vitest shared setup + mocks |

## packages/wallet-shared/

Shared between wallet and listener apps only. 201 files, 15 domains.

**Key Exports:**
- `src/stores/` - Zustand stores (sessionStore, walletStore, authenticationStore, clientIdStore)
- `src/wallet/smartWallet/` - Smart wallet logic
- `src/authentication/` - WebAuthn flows

**Store Pattern:**
```typescript
export const sessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    { name: "frak_session_store" }
  )
);

// CRITICAL: Individual selectors
const session = sessionStore((s) => s.session);
```

## packages/design-system/

Vanilla Extract design system. 28 components, semantic tokens, sprinkles. Replaces `packages/ui`.

**Key Files:**
- `src/tokens.css.ts` — Brand colors, scale, typography, semantic light/dark
- `src/theme.css.ts` — Theme contract (`vars.*`)
- `src/sprinkles.css.ts` — Responsive conditions (mobile/tablet/desktop)
- `src/components/Box/` — Core polymorphic layout primitive

**Usage:**
```typescript
import { Box } from "@frak-labs/design-system/components/Box";
import { vars } from "@frak-labs/design-system/theme.css";
```

See `packages/design-system/AGENTS.md` for full component list and patterns.

## packages/ui/

Radix-based component library. 22 components, 95 TS/TSX files.

**Structure:**
```
component/
├── Button/
├── Dialog/
├── Input/
└── ...
```

**Usage:**
```typescript
import { Button } from "@frak-labs/ui/component/Button";
```

## packages/app-essentials/

Core blockchain configuration. Consumed by backend (10), business (7), wallet (5).

**Key Files:**
- `src/blockchain/connector/` - FrakSmartWallet connector
- `src/blockchain/provider/` - Wagmi config

**Multi-Chain Support:**
```typescript
export const wagmiConfig = createConfig({
  chains: [arbitrum, base, polygon],
  transports: {
    [arbitrum.id]: http(RPC_URL_ARBITRUM),
    [base.id]: http(RPC_URL_BASE),
    [polygon.id]: http(RPC_URL_POLYGON),
  },
});
```

## packages/client/

Elysia Eden Treaty API client for type-safe backend communication.

## packages/test-foundation/

Shared test setup and mocks for 10 Vitest projects.

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `wallet-mocks.ts` - Wagmi, WebAuthn, IndexedDB mocks
- `apps-setup.ts` - Environment variables

**Fixtures:**
```typescript
test("my test", async ({
  mockAddress,
  mockSession,
  queryClient,
  queryWrapper,
  freshSessionStore,
  mockBackendAPI,
}) => {
  // Test implementation
});
```

## packages/dev-tooling/

Vite and CSS configuration.

**Exports:**
- `lightningCssConfig` - Centralized Lightning CSS settings
- `onwarn()` - Rollup warning suppression
- `getSandboxEnv()` - Atelier sandbox environment config

**Lightning CSS Config:**
- CSS Modules with camelCase
- Browser targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+
- Native CSS nesting support

## Testing

```bash
bun run test --project wallet-unit
bun run test --project wallet-shared-unit
```
