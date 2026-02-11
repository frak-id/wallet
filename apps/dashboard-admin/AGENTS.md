# apps/dashboard-admin

Internal admin interface for monitoring and managing the Frak ecosystem. TanStack Router SPA.

## Structure

```
app/
├── module/
│   ├── common/       # Providers, UI components, hooks
│   │   ├── provider/ # RootProvider (TanStack Query), ThemeProvider
│   │   ├── components/ui/ # Radix UI wrappers (button, card, sidebar, table)
│   │   ├── hooks/    # use-mobile
│   │   └── lib/      # utils, blockchain helpers
│   ├── campaign/     # Campaign management (hooks)
│   ├── health/       # Health monitoring (Ping, latency)
│   └── token/        # Token utilities (hooks)
├── routes/           # TanStack Router file-based routes
│   └── _layout/      # Main layout with sidebar navigation
└── styles/           # Global CSS (Tailwind)
```

## Where to Look

| Task | Location |
|------|----------|
| Admin features | `app/module/{feature}/` |
| Dashboard home | `app/routes/_layout/index.tsx` |
| Health monitoring | `app/module/health/` |
| Campaign admin | `app/module/campaign/` |
| Root layout | `app/routes/__root.tsx` |
| Sidebar nav | `app/routes/_layout.tsx` |

## Commands

```bash
bun run dev          # SST dev (port 3003)
bun run build        # Production build
bun run typecheck    # Type checking
```

## Conventions

- **Tailwind CSS** - ONLY app using Tailwind (all others use CSS Modules)
- **Custom Radix wrappers** - Does NOT use `@frak-labs/ui` package
- **No Zustand** - Uses TanStack Query only for state
- **No auth guards** - Access controlled at infrastructure/API level
- **Icons**: lucide-react

## Anti-Patterns

- Using CSS Modules here (this app uses Tailwind)
- Importing from `@frak-labs/ui` (has own component wrappers)
- Adding auth flows (handled at infra level)

## Differences from Business Dashboard

| Aspect | Admin | Business |
|--------|-------|----------|
| Styling | Tailwind | CSS Modules |
| UI package | Custom Radix | `@frak-labs/ui` |
| State | TanStack Query only | Zustand + TanStack Query |
| Auth | None (infra-level) | JWT + authStore |
| Size | ~34 files | ~345 files |

## Notes

- Smallest frontend app (~34 files)
- Pages: Products (dashboard), Members (stub), Campaigns (stub), Health (monitoring)
- Theme support (light/dark/system) via ThemeProvider
- Deployed to AWS via SST (not GCP like other production apps)
