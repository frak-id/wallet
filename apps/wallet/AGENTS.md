# apps/wallet

**Generated:** 2026-03-19
**Commit:** 50035fdd0
**Branch:** feat/vanilla-extract

TanStack Router SPA for user wallet. SSR disabled, module-based architecture with service worker.

## Structure

```
app/
├── module/           # Feature modules (13 modules)
│   ├── authentication/ # WebAuthn login/register
│   ├── biometrics/   # Biometric lock & settings
│   ├── common/       # Shared components (Header, Nav, Layout)
│   ├── history/      # Transaction & interaction history
│   ├── notification/ # Push notification management
│   ├── pairing/      # Device pairing (QR + WebSocket)
│   ├── recovery/     # Account recovery flows
│   ├── recovery-setup/ # Recovery passkey setup wizard
│   ├── root/         # Root layout & initialization
│   ├── settings/     # User settings management
│   ├── stores/       # App-level Zustand stores (recoveryStore)
│   ├── tokens/       # Token balances, send/receive
│   └── wallet/       # Core wallet operations
├── routes/           # TanStack Router file-based routes
│   └── _wallet/      # Protected wallet routes
├── styles/           # Global CSS
└── utils/            # App-level utilities
```

## Where to Look

| Task | Location |
|------|----------|
| Add new feature | `app/module/{feature}/` |
| Protected routes | `app/routes/_wallet/_protected/` |
| Global layout | `app/routes/__root.tsx` |
| Service worker | `app/service-worker.ts` |
| Route tree (generated) | `app/routeTree.gen.ts` |

## Commands

```bash
bun run dev          # Builds SW first, then starts SST dev
bun run build        # Production build (SW + TanStack Router)
bun run build:sw     # Service worker only
bun run typecheck    # TanStack Router typegen runs first
bun run test         # Unit tests (wallet-unit project)
bun run test:e2e     # Playwright E2E tests
```

## Styling (Vanilla Extract Migration)

Migrating from CSS Modules (`.module.css`) → Vanilla Extract (`.css.ts`). **In progress** — some components still use CSS Modules.

**New pattern**:
- Styles in `.css.ts` files using `style()`, `styleVariants()` from `@vanilla-extract/css`
- Layout via `Box` component with sprinkles props (no manual className for spacing/layout)
- Semantic tokens: `vars.text.*`, `vars.surface.*`, `vars.border.*` from `@frak-labs/design-system`
- Responsive: `{ mobile: ..., tablet: ..., desktop: ... }` via sprinkles conditions
- Vite plugin: `@vanilla-extract/vite-plugin` in `vite.config.ts`

**Import resolution**: tsconfig aliases `@/*` to both `./app/*` and `../../packages/design-system/src/*`

## Conventions

- **Module pattern**: Each feature in `app/module/{name}/` with own components, hooks, utils
- **Route guards**: Use `_wallet` layout for authenticated routes
- **i18n**: Translations in `@frak-labs/wallet-shared` (`packages/wallet-shared/src/i18n/locales/`), types via `bun run i18n:types` in root
- **Service Worker**: Must be built before dev/build (`bun run build:sw`)
- **Tauri**: Mobile/desktop support via `src-tauri/`

## Testing

- **Unit**: Vitest with jsdom, fixtures in `tests/vitest-fixtures.ts`
- **E2E**: Playwright specs in `tests/specs/`, page objects in `tests/pages/`
- **Mocks**: WebAuthn, Wagmi, router mocks from `@frak-labs/test-foundation`

## Notes

- PWA detection and safe area handling in `main.tsx`
- Route typegen is automatic via TanStack Router plugin
