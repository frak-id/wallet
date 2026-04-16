# apps/shopify — Compass

Embedded Shopify merchant app. React Router v7 (NOT Remix). Polaris v13. Drizzle + Postgres. SST v3 on AWS. Arbitrum. The only app with relative imports and 4-space Biome indent diverging from root `@/*` convention.

## Quick Commands
```bash
bun run dev              # SST dev → Shopify CLI tunnel
bun run shopify:dev      # Direct Shopify CLI (no SST)
bun run build            # react-router build
bun run typecheck        # react-router typegen && tsc --noEmit
bun run db:generate      # Drizzle migration (requires SST context)
bun run db:migrate       # Apply migrations
bun run deploy / deploy:prod          # SST stages: dev / production (NEVER "prod")
bun run shopify:deploy / :deploy:prod # Shopify app + extensions
bun run test             # Vitest (10 test files)
```

## Key Files
- `app/shopify.server.ts` — OAuth, session storage (Memory on localhost, Drizzle when deployed)
- `app/routes/` — flat routes: `app.{name}.tsx` (authenticated UI), `api.{name}.tsx` (API)
- `app/services.server/` — 11 services + 9 tests; GraphQL lives here; all take `AuthenticatedContext` first
- `app/hooks/` — client-side (React Query + viem multicall)
- `app/components/` — feature-organized Polaris UI
- `app/utils/{onboarding.ts, url.ts, backendApi.ts, viemClient.ts, campaignCreation.ts, tokenStatus.ts, navigationLoading.ts}` — 6-step wizard, URL helpers, ky client, viem wiring
- `db/schema/{sessionTable, purchaseTable}.ts` · `db/adapter/sessionAdapter.ts` (custom Shopify SessionStorage)
- Infra lives at repo-root `infra/` (not here) · `shopify.app.{development,frakdevr,production}.toml` (3 configs)
- `drizzle/{dev,prod}/` — separate migration histories per stage

## Non-Obvious Patterns
- **React Router v7, not Remix**: `@shopify/shopify-app-react-router`, `react-router typegen`. Don't import Remix.
- **Relative imports ONLY** — no `@/*` aliases (breaks with `vite-tsconfig-paths`).
- **Stage literal `"prod"` is FORBIDDEN** — `sst.config.ts` throws; use `"production"`.
- **Session-loss traps**: no bare `<a>`, no `redirect` from `react-router` in auth routes, no lowercase `<form/>` — embedded app loses Shopify session. Use `Link`/`Form`/`useFetcher()` and `redirect` from `authenticate.admin`.
- **README lies**: it mentions Prisma/SQLite — actual stack is Drizzle/Postgres.
- **Webhooks** are per-config in `.toml` — no `afterAuth` registration.
- **Build-time env**: `vite.config.ts` `define` injects SST secrets into `process.env.*` — not runtime.
- **Services never throw**: return `null` on error. Named exports only.
- **LRU cache tiers**: shop 1min · theme 30s · merchant 5min · onchain/campaigns 5s. React Query: stale 1min, gc infinity, localStorage persist.
- **Onboarding = 6-step wizard** (`utils/onboarding.ts`): merchant, pixel, webhooks, Frak webhook, theme blocks, buttons. Use `stepValidations` + `stepDataFetchers`.
- **Biome cognitive complexity 17** (higher than root's 16).
- **Web Components**: `frak-button-wallet` (shadow DOM), `frak-button-share` / `frak-open-in-app` (light DOM — inherit theme CSS).

## Anti-Patterns
`<a>` · `redirect` from `react-router` · lowercase `<form>` · path aliases · `"prod"` stage · `any`/`!`/`as T` (except JSON parse boundaries) · throwing in services.

## See Also
Parent `/AGENTS.md` · sub `app/{routes,services.server,hooks,components}/AGENTS.md` · `apps/shopify/extensions/AGENTS.md` (theme blocks + checkout pixel) · `services/backend/` (webhook contracts) · `sdk/components/` (Web Components).
