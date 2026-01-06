# packages/wallet-shared

Shared code for wallet and listener apps ONLY. Not used by business/admin.

## Structure

```
src/
├── authentication/   # WebAuthn auth (hooks, components, session)
├── blockchain/       # Viem providers, AA connectors
├── common/           # Shared utils, analytics (OpenPanel)
├── i18n/             # react-i18next setup
├── interaction/      # Interaction tracking
├── pairing/          # Device pairing (WebSocket, signatures)
├── providers/        # FrakContext for SDK integration
├── recovery/         # Account recovery flows
├── sdk/              # SDK lifecycle utilities
├── stores/           # Zustand stores (4 stores)
├── tokens/           # Token management
├── types/            # Shared TypeScript types (11 files)
└── wallet/           # Smart wallet operations (15 files)
```

## Where to Look

| Task | Location |
|------|----------|
| Session management | `src/stores/` (sessionStore, userStore, walletStore) |
| WebAuthn flows | `src/authentication/` |
| Wallet operations | `src/wallet/` |
| Device pairing | `src/pairing/` |
| Type definitions | `src/types/` |

## Stores (Zustand)

| Store | Purpose |
|-------|---------|
| `sessionStore` | Auth session state |
| `userStore` | User profile data |
| `walletStore` | Wallet connection state |
| `authenticationStore` | WebAuthn state |

## Conventions

- **Barrel exports**: Import from `@frak-labs/wallet-shared`
- **Store selectors**: Always use `store((s) => s.field)`
- **idb-keyval**: IndexedDB via lightweight idb-keyval (SW-optimized)

## Anti-Patterns

- Importing in business/admin apps (wallet+listener only)
- Direct store subscriptions
- Heavy IndexedDB operations (use idb-keyval)

## Dependencies

- `@frak-labs/ui`, `@frak-labs/app-essentials`
- `@frak-labs/core-sdk`, `@frak-labs/frame-connector`
- Zustand, Viem, Wagmi, TanStack Query

## Testing

- Vitest project: `wallet-shared-unit`
- Tests co-located in `src/` or `tests/`
- Mock stores with fresh instances per test

## Notes

- 201 TS/TSX files - largest shared package
- Used 228 times: wallet (153) + listener (75)
- ⚠️ Known issue: AlertDialog duplicated with `ui` package
