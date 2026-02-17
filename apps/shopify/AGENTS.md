# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-12 · **Commit:** e39140c · **Branch:** main

## OVERVIEW

Frak Shopify app — embedded React Router v7 app enabling referral/share-to-earn campaigns via blockchain (Frak protocol). Merchants install theme blocks + checkout pixel, configure campaigns, fund reward banks. Stack: React Router v7 + Vite, Polaris v13, Drizzle/PostgreSQL, SST v3 (AWS), viem (Arbitrum), React Query v5.

## STRUCTURE

```
.
├── app/
│   ├── routes/             # React Router flat routes (19 files) → see routes/AGENTS.md
│   ├── services.server/    # Server business logic (11 services + 6 tests) → see services.server/AGENTS.md
│   ├── hooks/              # Client hooks (blockchain, React Query) → see hooks/AGENTS.md
│   ├── components/         # Polaris-based UI, feature-organized → see components/AGENTS.md
│   ├── utils/              # ABI defs, API clients, viem, onboarding logic
│   ├── providers/          # RootProvider (React Query + Frak SDK)
│   ├── types/              # AuthenticatedContext type definition
│   ├── i18n/               # i18next setup (en/fr)
│   ├── shopify.server.ts   # Shopify app init, OAuth, session storage
│   ├── db.server.ts        # Drizzle postgres connection
│   └── root.tsx            # HTML shell, i18n locale
├── db/
│   ├── schema/             # sessionTable, purchaseTable (Drizzle)
│   └── adapter/            # DrizzleSessionStorageAdapter (implements SessionStorage)
├── extensions/             # Shopify extensions → see extensions/AGENTS.md
├── infra/
│   ├── config.ts           # Stage-based URLs, SST secrets
│   └── shopify.ts          # sst.aws.React resource definition
├── drizzle/{dev,prod}/     # Separate migration histories per stage
└── shopify.app.*.toml      # 3 app configs: development, frakdevr, production
```

## WHERE TO LOOK

| Task                        | Location                                             | Notes                                                                       |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Add route                   | `app/routes/`                                        | Flat routes: `app.{name}.tsx` for authenticated, `api.{name}.tsx` for API   |
| Add Shopify API call        | `app/services.server/`                               | All GraphQL in services, use `AuthenticatedContext` param                   |
| Add blockchain query        | `app/hooks/`                                         | Client-side via React Query + viem multicall                                |
| Resolve merchant ID         | `app/services.server/merchant.ts`                    | LRU cache → metafield → backend API fallback                                |
| Fetch backend merchant data | `app/services.server/backendMerchant.ts`             | Campaigns, bank status, stats. **Currently unused by routes**               |
| Modify campaign ABIs        | `app/utils/abis/campaignAbis.ts`                     | 1260-line ABI definitions (7 contracts)                                     |
| Change DB schema            | `db/schema/`                                         | Then `bun run db:generate && bun run db:migrate`                            |
| Add SST secret              | `infra/config.ts`                                    | `new sst.Secret("NAME")`, link in `infra/shopify.ts`                        |
| Edit theme blocks           | `extensions/theme-components/blocks/`                | Liquid templates                                                            |
| Modify checkout tracking    | `extensions/checkout-web-pixel/src/index.ts`         | Purchase event listener                                                     |
| i18n strings                | `app/i18n/` + `extensions/theme-components/locales/` | Separate i18n for app vs extensions                                         |
| Add API client              | `app/utils/`                                         | Use `ky.create({ prefixUrl })` pattern, see `backendApi.ts`                 |
| Add provider/context        | `app/providers/`                                     | Wrap in `RootProvider` (React Query + Frak SDK)                             |
| Onboarding steps            | `app/utils/onboarding.ts`                            | 6-step wizard: `stepValidations` + `stepDataFetchers`                       |
| URL/validation helpers      | `app/utils/url.ts`                                   | `isAbsoluteUrl`, `parseChargeId`, `validateMintParams`, `buildCampaignLink` |

## CONVENTIONS

- **4-space indent** (Biome v2). Double quotes. Always semicolons. Trailing commas ES5.
- **Biome-only** — no ESLint, no Prettier. Format: `bun format`. Lint: `bun lint`.
- **Relative imports only** — no path aliases. `import type` enforced.
- **TypeScript strict mode**. ES2022 target. Bundler module resolution.
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.
- **Server files**: `*.server.ts` suffix or in `services.server/` dir.
- **Services pattern**: async functions taking `AuthenticatedContext` as first param. Named exports only. Never throw — return `null` on error.
- **Hooks pattern**: `use{Feature}.ts`, React Query for async, `useMemo` for URL builders.
- **Components**: feature-organized dirs (`Stepper/`, `Campaign/`, `Funding/`), `index.tsx` entry.
- **API clients**: `ky` HTTP client for external APIs (`backendApi`, `indexerApi` in `utils/`).
- **Caching**: LRU on server (shop: 1min, theme: 30s, merchant: 5min, onchain/campaigns: 5s). React Query on client (stale: 1min, gc: infinity, localStorage persist).
- **Enums**: Drizzle `pgEnum` for DB status fields, not TS enums.
- **Tests**: vitest. Co-located `*.test.ts` files. 10 test files across services + utils.

## DEPENDENCY GRAPH (unidirectional)

```
utils/ (pure: ABIs, API clients, onboarding logic, viem)
  ↑
  ├─ hooks/ (React Query + viem multicall)
  ├─ services.server/ (Shopify GraphQL + backend/indexer APIs)
  └─ components/ (Polaris UI, hooks, other components)
       ↑
       └─ routes/ (loaders → services, components → UI)
```

## ANTI-PATTERNS (THIS PROJECT)

- **No `<a>` tags** — use `Link` from React Router or Polaris. Embedded app loses session otherwise.
- **No `redirect` from `react-router`** in authenticated routes — use redirect from `authenticate.admin`. Embedded app loses session.
- **No lowercase `<form/>`** — use `useFetcher()` or `<Form/>` from React Router.
- **Stage "prod" is forbidden** — `sst.config.ts` throws if stage === "prod". Use "production".
- **No `any`, no `!`, no `as Type`** — strict type safety. Biome enforces `useImportType`/`useExportType`. Exception: `as T` at JSON parse boundaries is acceptable.
- **Cognitive complexity max 17** — Biome rule. Extract logic into helper functions.
- **No afterAuth webhooks** — use app-specific webhooks in `.toml` files.
- **README lies about Prisma/SQLite** — project uses Drizzle/PostgreSQL. Ignore README DB docs.

## DATA FLOW

```
Shopify Admin → OAuth → app/shopify.server.ts → Session stored (Drizzle or Memory)
                                                      ↓
Route loader (authenticate.admin) → AuthenticatedContext
  ├── services.server/* (GraphQL queries, metafields, backend API, theme)
  └── Response → Client components
                    ├── hooks/* (React Query → indexer API, backend API, viem)
                    └── Polaris UI

Theme blocks (listener.liquid) → Frak SDK → sessionStorage token
Checkout pixel → reads token → POST to backend.frak.id/interactions/listenForPurchase
```

## DATABASE

Two tables, no relationships, no foreign keys:

- **session** — Shopify OAuth sessions (PK: `id` text). Custom adapter in `db/adapter/sessionAdapter.ts`.
- **purchase** — App purchase tracking with dual status: `shopifyStatus` (pending|active|declined|expired) + `frakTxStatus` (pending|confirmed). Links Shopify purchase to blockchain tx.

Migrations: `drizzle/{dev,prod}/` — separate histories. Run via `bun run db:generate` then `bun run db:migrate` (both require SST context).

## COMMANDS

```bash
bun run dev              # SST dev → Shopify CLI tunnel
bun run shopify:dev      # Direct Shopify CLI (no SST)
bun run build            # react-router build
bun run deploy           # sst deploy --stage dev
bun run deploy:prod      # sst deploy --stage production
bun run shopify:deploy   # shopify app deploy --config development
bun run shopify:deploy:prod
bun run db:generate      # drizzle-kit generate (via sst dev)
bun run db:migrate       # drizzle-kit migrate (via sst dev)
bun run db:studio        # Drizzle Studio GUI
bun run typecheck        # react-router typegen && tsc --noEmit
bun run format           # biome check --write .
bun run lint             # biome lint .
bun run test             # vitest run
bun run test:watch       # vitest (watch mode)
```

Quality checks script: `checks.sh` → format + typecheck + build.

## DEPLOYMENT

Dual deploy: **SST** (AWS infra via `sst.aws.React`) + **Shopify CLI** (app config + extensions).

| Stage      | Domain                     | DB           | Shopify Config               |
| ---------- | -------------------------- | ------------ | ---------------------------- |
| dev        | extension-shop-dev.frak.id | shopify_dev  | shopify.app.development.toml |
| production | extension-shop.frak.id     | shopify_prod | shopify.app.production.toml  |

SST secrets (AWS Secrets Manager): `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `SHOPIFY_API_SECRET`, `PRODUCT_SETUP_CODE_SALT`, `RPC_SECRET`.

Env vars injected at build time via `vite.config.ts` `define` block. Secrets from SST `Resource` object.

## NOTES

- **Migrated from Remix to React Router v7**: Uses `@shopify/shopify-app-react-router` (not remix), `react-router` ^7.0.0. Build: `react-router build`. Typegen: `react-router typegen`.
- **Onboarding flow**: 6-step wizard validates merchant registered, pixel created, webhooks configured, Frak webhook active, theme blocks installed, buttons added. See `app/utils/onboarding.ts`.
- **Frak ecosystem URLs**: backend.frak.id (API), wallet.frak.id (wallet), ponder.gcp.frak.id (indexer), business.frak.id (dashboard). Dev variants: `*.v2.gcp-dev.frak.id` or `*-dev.frak.id`.
- **Session storage conditional**: Memory for localhost, Drizzle for deployed. See `app/shopify.server.ts:14`.
- **Shopify API version**: `ApiVersion.January25` in app config.
- **Scopes**: `read_customer_events,read_orders,read_pixels,read_products,read_themes,write_pixels`.
- **vite.config.ts** injects SST secrets into `process.env.*` via `define` — build-time replacements, not runtime env vars.
- **Blockchain**: Arbitrum (prod) / Arbitrum Sepolia (dev). RPC via erpc.gcp.frak.id. viem multicall with 50ms batching.
- **Node requirement**: ^20.10 || >=21.0.0.
- **Third Shopify config**: `shopify.app.frakdevr.toml` for staging (FrakDevR), uses Cloudflare tunnel, API v2025-04.
- **Debug log**: `backendMerchant.ts:86` has `console.log(1, sessionToken)` left in code.
