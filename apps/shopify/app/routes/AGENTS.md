# routes/ — React Router v7 Flat Routes

19 route files. Three categories: `app.*` (authenticated admin), `api.*` (JSON endpoints), `auth.*` (OAuth), plus standalone `webhooks.tsx` and `purchase.tsx`.

## ROUTE HIERARCHY

```
/                          → _index.tsx (redirect → /app)
/app                       → app.tsx (layout: auth + shop data + onboarding)
  /                        → app._index.tsx (dashboard, uses parent data)
  /appearance              → app.appearance.tsx (i18n + appearance settings)
  /campaigns               → app.campaigns.tsx (campaign status)
  /funding                 → app.funding.tsx (bank + purchase status)
  /onboarding              → app.onboarding.tsx (action only: clears onchain cache)
  /settings                → app.settings.tsx (tab router, no loader)
    /general               → app.settings.general.tsx
    /pixel                 → app.settings.pixel.tsx
    /theme                 → app.settings.theme.tsx
    /webhook               → app.settings.webhook.tsx
/auth/*                    → auth.$.tsx (catch-all auth)
/auth/login                → auth.login/route.tsx + error.server.tsx
/api/purchase              → api.purchase.tsx (JSON)
/api/mint                  → api.mint.tsx (JSON)
/purchase                  → purchase.tsx (standalone, no auth)
/webhooks                  → webhooks.tsx (webhook handler)
```

## PATTERN

### Loader

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const context = await authenticate.admin(request);
  const data = await someService(context);
  return Response.json(data);
}
```

### Action (intent-based dispatch)

```ts
export async function action({ request }: Route.ActionArgs) {
  const context = await authenticate.admin(request);
  const formData = await request.formData();
  switch (formData.get("intent")) {
    case "create":
      return Response.json(await createThing(context));
    case "delete":
      return Response.json(await deleteThing(context));
  }
}
```

## AUTHENTICATION

| Route prefix | Auth method                     | Returns                    |
| ------------ | ------------------------------- | -------------------------- |
| `app.*`      | `authenticate.admin(request)`   | `AuthenticatedContext`     |
| `api.*`      | `authenticate.admin(request)`   | `AuthenticatedContext`     |
| `auth.*`     | `login(request)`                | Login flow                 |
| `webhooks`   | `authenticate.webhook(request)` | `{ shop, topic, payload }` |
| `purchase`   | None                            | Standalone page            |

## SERVICE DEPENDENCIES

| Route                  | Services Called                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.tsx`              | `shopInfo`, `resolveMerchantId`, `doesThemeSupportBlock`, `fetchAllOnboardingData`                                                                                                            |
| `app.appearance`       | `getI18nCustomizations`, `getAppearanceMetafield`, `doesThemeHasFrakButton`, `firstProductPublished`, `doesThemeHasFrakWalletButton`, `updateI18nCustomizations`, `updateAppearanceMetafield` |
| `app.campaigns`        | `getOnchainProductInfo`                                                                                                                                                                       |
| `app.funding`          | `getOnchainProductInfo`, `getCurrentPurchases`                                                                                                                                                |
| `app.onboarding`       | `clearOnChainShopCache` (action only)                                                                                                                                                         |
| `app.settings.general` | `getOnchainProductInfo`                                                                                                                                                                       |
| `app.settings.pixel`   | `getWebPixel`, `createWebPixel`, `deleteWebPixel`                                                                                                                                             |
| `app.settings.theme`   | `doesThemeHasFrakActivated`, `getMainThemeId`                                                                                                                                                 |
| `app.settings.webhook` | `resolveMerchantId`, `frakWebhookStatus`, `getWebhooks`, `createWebhook`, `deleteWebhook`                                                                                                     |
| `api.purchase`         | `startupPurchase`                                                                                                                                                                             |
| `api.mint`             | `getProductSetupCode`                                                                                                                                                                         |

## CONVENTIONS

- **Parallel fetching**: `Promise.all()` in loaders when multiple services needed.
- **Intent-based actions**: `formData.get("intent")` to dispatch create/delete/save.
- **Mutations via `useFetcher()`**: All form submissions go through `useFetcher()` in child components.
- **Return `Response.json()`**: Not plain objects from loaders/actions.
- **Layout data access**: Child routes use `useRouteLoaderData<typeof loader>("routes/app")` for parent data.
- **Route types**: `Route.LoaderArgs` / `Route.ActionArgs` from React Router v7 type generation.
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

## ANTI-PATTERNS

- **No `redirect` from `react-router`** in authenticated routes — use redirect from `authenticate.admin`. Embedded app loses session.
- **No lowercase `<form/>`** — use `useFetcher()` in components.
- **No direct service imports in components** — services are server-only; pass data via loaders.
