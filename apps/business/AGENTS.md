# apps/business

**Generated:** 2026-03-06
**Commit:** 03e50a956
**Branch:** dev

Largest app in monorepo (345 TS/TSX files). TanStack Router SPA dashboard for business users. Campaign management, product setup, analytics. Served via nginx in production.

## Structure

```
src/
├── module/           # Feature modules (10 modules)
│   ├── campaigns/    # 29 hooks, 15 components
│   ├── common/       # Shared components, hooks, layouts
│   ├── dashboard/    # Overview dashboard
│   ├── embedded/     # Embedded integration views
│   ├── forms/        # Form components
│   ├── login/        # Authentication flows
│   ├── members/      # Team member management
│   ├── merchant/     # 17 hooks
│   ├── product/      # 29 hooks
│   └── settings/     # Business settings
├── routes/           # TanStack Router file-based routes
│   └── _restricted/  # Protected routes layout
├── stores/           # Zustand stores (separate from modules)
├── styles/           # Global CSS
└── utils/            # App-level utilities
```

## Where to Look

| Task | Location |
|------|----------|
| Campaign logic | `src/module/campaigns/` |
| Product setup | `src/module/product/` |
| Protected routes | `src/routes/_restricted/` |
| Root component | `src/routes/__root.tsx` |
| Nginx config | `nginx.conf` |

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
- **Production**: nginx serves static files with pre-compressed gzip
- **Config**: Baked at build time via Vite `define` (no runtime env vars)

## Testing

- Vitest with jsdom, co-located `*.test.ts` files
- Mocks from `@frak-labs/test-foundation`

## Notes

- Dockerfile uses nginx:1.29.1 with pre-compressed static assets
