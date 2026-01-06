# apps/wallet

TanStack Router SPA for user wallet. SSR disabled, module-based architecture with service worker.

## Structure

```
app/
├── module/           # Feature modules (main code lives here)
│   ├── common/       # Shared components, hooks, utils
│   ├── listener/     # SDK listener integration
│   ├── notifications/ # Push notifications
│   ├── recovery/     # Account recovery flows
│   ├── settings/     # User settings management
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

## Conventions

- **Module pattern**: Each feature in `app/module/{name}/` with own components, hooks, utils
- **Route guards**: Use `_wallet` layout for authenticated routes
- **i18n**: Translations in `public/locales/`, types via `bun run i18n:types`
- **Service Worker**: Must be built before dev/build (`bun run build:sw`)

## Anti-Patterns

- Direct store subscription (use selectors)
- Skipping service worker build
- Adding routes outside file-based routing
- CSS outside modules (use CSS Modules)

## Testing

- **Unit**: Vitest with jsdom, fixtures in `tests/vitest-fixtures.ts`
- **E2E**: Playwright specs in `tests/specs/`, page objects in `tests/pages/`
- **Mocks**: WebAuthn, Wagmi, router mocks from `@frak-labs/test-foundation`

## Notes

- Tauri support for desktop/mobile builds (`src-tauri/`)
- PWA detection and safe area handling in `main.tsx`
- Route typegen is automatic via TanStack Router plugin
