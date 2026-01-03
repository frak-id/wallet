# apps/business

TanStack Start SSR dashboard for business users. Campaign management, product setup, analytics.

## Structure

```
src/
├── module/           # Feature modules
│   ├── campaigns/    # Campaign creation, management, analytics
│   ├── common/       # Shared components, hooks, layouts
│   ├── dashboard/    # Overview dashboard
│   ├── members/      # Team member management
│   ├── paywall/      # Billing integration
│   ├── product/      # Product setup, configuration
│   ├── settings/     # Business settings
│   └── wallet/       # Wallet connection
├── routes/           # TanStack Start file-based routes
├── stores/           # Zustand stores
├── styles/           # Global CSS
└── utils/            # App-level utilities
```

## Where to Look

| Task | Location |
|------|----------|
| Campaign logic | `src/module/campaigns/` (29 hooks, 15 components) |
| Product setup | `src/module/product/` (29 hooks) |
| Root HTML shell | `src/routes/__root.tsx` |
| API routes | `src/routes/api/` |
| Stores | `src/stores/` |

## Commands

```bash
bun run dev          # TanStack Start dev (port 3022)
bun run build        # Production build (Nitro output)
bun run start        # Preview production build
bun run typecheck    # Type checking
bun run test         # Unit tests (business-unit project)
```

## Conventions

- **SSR-first**: Full HTML shell in `__root.tsx` with meta tags
- **Module pattern**: Features in `src/module/{name}/`
- **Stores**: Zustand with persist, located in `src/stores/`
- **API routes**: Server endpoints in `src/routes/api/`

## Anti-Patterns

- Client-only code without proper SSR guards
- Direct DOM manipulation (use React state)
- Entire store subscriptions

## Notes

- Largest app in monorepo (345 TS/TSX files)
- SSR requires careful hydration handling
- TanStack Start uses Vinxi under the hood
