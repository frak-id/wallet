# apps/shopify — Compass

Embedded Shopify merchant app. React Router 7 (NOT Remix) on `@shopify/shopify-app-react-router` 4. Polaris web components 2 (`<s-*>`, from Shopify's CDN). Admin API `2026-10`. Drizzle + Postgres. Express SSR server on GKE (`infra/gcp/shopify.ts`, driven by SST). Arbitrum. No `@/*` alias, unlike the other apps.

## Quick Commands

```bash
bun run shopify:dev      # Direct Shopify CLI (no SST env); root `bun run dev` offers it as the `shopify` dev command
bun run build            # react-router build
bun run typecheck        # react-router typegen && tsc --noEmit — covers extensions/*/src too
bun run db:generate      # Drizzle migration into drizzle/prod/ only when STAGE=production
bun run db:migrate       # Apply migrations
bun run shopify:deploy / :deploy:prod # Shopify app + extensions (regenerates stage artifacts first)
bun run gen:stage                     # Rewrite the generated stage artifacts to the prod table

# from the repo root
bun run test -- --project shopify-unit   # NOT `bun run test` here: the shared html reporter needs @vitest/ui, not installed in this app
bun run deploy-gcp:staging / deploy-gcp:prod   # the SSR server on GKE
```

## Key Files

- `app/shopify.server.ts` — `shopifyApp()`: API version, OAuth, session storage (Memory on a `trycloudflare.com` tunnel, Drizzle otherwise)
- `app/utils/polaris.ts` — `POLARIS_URL`, the only Polaris CDN URL (see Non-Obvious Patterns)
- `server.js` — production Express server: `react-router-serve` minus `/health` access logs, plus a request-body cap
- `app/routes/` — flat routes: `app.{name}.tsx` (authenticated UI), `api.{name}.tsx` (API)
- `app/services.server/` — GraphQL lives here; all take `AuthenticatedContext` first
- `app/hooks/` — client-side (React Query + viem multicall)
- `app/components/` — feature-organized UI on Polaris web components
- `app/utils/` — onboarding wizard state, URL helpers, ky backend client, viem wiring
- `db/schema/{sessionTable, purchaseTable}.ts` · `db/adapter/sessionAdapter.ts` (custom Shopify SessionStorage)
- `proxy/ambassador.liquid` — the app proxy ambassador page (see Non-Obvious Patterns)
- Infra lives at repo-root `infra/` (not here) · `shopify.app.{development,production}.toml`
- `drizzle/{dev,prod}/` — separate migration histories per stage

## Non-Obvious Patterns

- **React Router 7, not Remix, and it cannot move to 8 yet**: `@shopify/shopify-app-react-router` 4 peers `react-router ^7.6.2` (Shopify/shopify-app-js#3319). That also holds `remix-i18next` on 7 and the `remix-utils` catalog entry on 9, whose next majors require React Router 8. `react-router.config.ts` already opts into every v8 future flag. Don't import Remix.
- **Polaris is web components, not the React package**: `<s-*>` elements typed by `@shopify/polaris-types`, with the runtime (`polaris-2.js`, the Admin Next theme) loaded from the CDN. `POLARIS_URL` feeds `AppProvider`, `shopifyApp({ polarisUrl })` (the preload `Link` header) and the two pages outside the admin; a second literal lets the script tag and the preload disagree. A Polaris major is that constant plus `@shopify/polaris-types`.
- **`AppProvider` is admin-only**: it always renders App Bridge and requires `apiKey`. `/auth/login` and `/purchase` render outside the admin, so they skip it and emit `<script src={POLARIS_URL} />` themselves.
- **Imports**: relative, or the `app/*` / `db/*` tsconfig paths (resolved by Vite's native `resolve.tsconfigPaths`). There is no `@/*` alias.
- **Stage naming**: the deployed stages are `gcp-staging` / `gcp-production`, so runtime `STAGE` is `staging` / `production`. `isProd()` (`utils/env.ts`) also accepts `prod`; `drizzle.config.ts` does not, so `STAGE=prod bun run db:generate` writes into `drizzle/dev/`.
- **Session-loss traps**: no bare `<a>`, no `redirect` from `react-router` in auth routes, no lowercase `<form/>` — embedded app loses Shopify session. Use `Link`/`Form`/`useFetcher()` and `redirect` from `authenticate.admin`.
- **Webhooks**: app topics are declared per config in `shopify.app.*.toml` (no `afterAuth` registration) and land on `/webhooks`. `ORDERS_UPDATED` is the exception: onboarding creates it with `webhookSubscriptionCreate`, pointed at the backend, which accepts any `x-shopify-api-version` ≥ 2024-10.
- **The API version moves as a set**: `ApiVersion.*` in `app/shopify.server.ts`, both app tomls, the three extension tomls and `@shopify/ui-extensions`. The list is in `extensions/AGENTS.md`. A new version also needs a `@shopify/shopify-api` that exports it.
- **Storefront origins are baked at deploy, not read from metafields**: dev and prod are two different Shopify apps, so `scripts/generateStageArtifacts.ts` writes the wallet/backend/SDK origins into `extensions/theme-components/blocks/listener.liquid` (the `frak:stage` region) and `extensions/checkout-post-purchase/src/frakStage.gen.ts` before each deploy. Both are committed on the **prod** table and gated by `bun run check:shopify-stage` inside root `lint` — `shopify app deploy` uploads the working tree, so a stale dev generation would reach every merchant. See `extensions/AGENTS.md`.
- **Two backend URLs**: `BACKEND_URL` = server→backend calls (`utils/backendApi.ts`), stays `localhost:3030` in the local stage. `PUBLIC_BACKEND_URL` = callbacks Shopify's servers / the shopper's browser must reach (`services.server/webhook.ts` order webhook, `webPixel.ts` pixel) — same as `BACKEND_URL` except local, where it defaults to the public dev backend (`localhost` is rejected as an internal domain). Override `PUBLIC_BACKEND_URL` with a `cloudflared tunnel --url https://localhost:3030 --no-tls-verify` URL to route webhooks/pixel to a local backend. Both defined per-stage in `infra/config.ts`. Local dev also sets `NODE_OPTIONS=--use-system-ca` (`infra/gcp/shopify.ts`) so Node trusts the mkcert CA when calling the local HTTPS backend — **requires Node ≥ 22.15** (older Node aborts every spawned process with "bad option: --use-system-ca").
- **Build-time env is public only**: `vite.config.ts` `define` bakes `STAGE`, the wallet/components/business/backend URLs (both backend ones), `SHOPIFY_API_KEY` and `SHOPIFY_APP_URL` into the bundle. Secrets (DB password, API secret) stay runtime `process.env`, injected by Kubernetes.
- **Services never throw**: return `null` on error. Named exports only.
- **LRU cache tiers**: shop 1min · theme 30s · merchant 5min · onchain/campaigns 5s. React Query: stale 1min, gc infinity, localStorage persist.
- **Onboarding is a wizard driven by `utils/onboarding.ts`**: merchant, pixel, Shopify webhooks, Frak webhook, theme activation, share button, banner. Use `stepValidations` + `stepDataFetchers`; `MAX_STEP` derives from `stepValidations`, so never hardcode a step count anywhere.
- **No Biome divergence**: there is no `apps/shopify/biome.json` and no root override — shopify inherits root's settings, cognitive complexity 16 included.
- **The ambassador page is an app proxy, not a `/pages/` page**: Shopify renders `proxy/ambassador.liquid` inside the theme layout at `/apps/ambassador` (`/apps/ambassador-dev` for the dev app). Production fetches the file from `sdk.frak.id/shopify/ambassador` (`infra/sdk-pointer.ts`), every other stage from the `proxy.ambassador` route, which inlines it with `?raw`. Shop state comes only from the `frak.ambassador_page` metafield, read by the Liquid. Deploy the `sdk-pointer` stack before `shopify app deploy`, or the proxy points at a missing file.
- **Web Components**: `frak-button-wallet` (shadow DOM; legacy name, opens the sharing page), `frak-button-share` / `frak-open-in-app` (light DOM — inherit theme CSS).

## Anti-Patterns

`<a>` · `redirect` from `react-router` · lowercase `<form>` · `@/*` imports · `AppProvider` on a page outside the admin · a Polaris CDN URL outside `utils/polaris.ts` · `STAGE=prod` for Drizzle · `any`/`!`/`as T` (except JSON parse boundaries) · throwing in services.

## See Also

Parent `/AGENTS.md` · sub `app/{routes,services.server,hooks,components}/AGENTS.md` · `apps/shopify/extensions/AGENTS.md` (theme blocks + checkout pixel) · `services/backend/` (webhook contracts) · `sdk/components/` (Web Components).
