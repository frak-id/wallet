# apps/business

TanStack Router SPA dashboard for business users. Campaign management, product setup, analytics. Served via nginx in production.

## Structure

```
src/
├── module/           # Feature modules
│   ├── campaigns/    # Campaign creation, management, analytics
│   ├── common/       # Shared components, hooks, layouts
│   ├── dashboard/    # Overview dashboard
│   ├── embedded/     # Embedded integration views
│   ├── login/        # Authentication flows
│   ├── members/      # Team member management
│   ├── merchant/     # Merchant management (17 hooks)
│   ├── paywall/      # Billing integration
│   ├── product/      # Product setup, configuration
│   ├── settings/     # Business settings
│   └── wallet/       # Wallet connection
├── routes/           # TanStack Router file-based routes
├── stores/           # Zustand stores
├── styles/           # Global CSS
└── utils/            # App-level utilities
```

## Where to Look

| Task | Location |
|------|----------|
| Campaign logic | `src/module/campaigns/` (29 hooks, 15 components) |
| Product setup | `src/module/product/` (29 hooks) |
| Root component | `src/routes/__root.tsx` |
| HTML shell | `index.html` |
| Nginx config | `nginx.conf` |
| Stores | `src/stores/` |

## Commands

```bash
bun run dev          # SST dev + Vite (port 3001)
bun run build        # Production build (static output)
bun run typecheck    # Type checking
bun run test         # Unit tests (business-unit project)
```

## Conventions

- **SPA**: Static HTML shell in `index.html`, client-side routing
- **Module pattern**: Features in `src/module/{name}/`
- **Stores**: Zustand with persist, located in `src/stores/`
- **Production**: nginx serves static files with pre-compressed gzip

## Anti-Patterns

- Direct DOM manipulation (use React state)
- Entire store subscriptions

## Notes

- Largest app in monorepo (345 TS/TSX files)
- Config baked at build time via Vite `define` (no runtime env vars)
- Dockerfile uses nginx:1.29.1 with pre-compressed static assets
