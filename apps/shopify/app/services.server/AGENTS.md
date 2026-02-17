# services.server/ — Server Business Logic

11 service files + 6 test files. All Shopify Admin API + external API interactions live here. **Never import these from client code.**

## PATTERN

Every service exports **async functions** taking `AuthenticatedContext` as first param:

```ts
import type { AuthenticatedContext } from "../types/context";

export async function doSomething(
    context: AuthenticatedContext,
    params: { ... }
): Promise<Result> {
    const { admin, session } = context;
    const response = await admin.graphql(`query { ... }`, { variables: { ... } });
    const { data } = await response.json();
    return data;
}
```

`AuthenticatedContext` = `Awaited<ReturnType<typeof authenticate.admin>>`. Defined in `app/types/context.ts`.

## INVENTORY

| Service                 | Purpose                                                    | Caching  | External API                       |
| ----------------------- | ---------------------------------------------------------- | -------- | ---------------------------------- |
| **shop.ts**             | Shop metadata (name, domain, currency), first product      | LRU 1min | Shopify GraphQL                    |
| **metafields.ts**       | Read/write shop metafields (i18n, appearance, merchant_id) | None     | Shopify GraphQL                    |
| **theme.ts**            | Theme inspection, block detection, Frak integration        | LRU 30s  | Shopify GraphQL                    |
| **webPixel.ts**         | Web pixel CRUD                                             | None     | Shopify GraphQL                    |
| **webhook.ts**          | Webhook subscription management + Frak status check        | None     | Shopify GraphQL + backend API      |
| **purchase.ts**         | One-time app purchases, DB tracking                        | None     | Shopify GraphQL + Drizzle          |
| **purchase.helpers.ts** | Validation (amount, bank address), GID parsing             | None     | Pure functions                     |
| **merchant.ts**         | Merchant ID resolution (cache → metafield → backend)       | LRU 5min | Shopify GraphQL + backend API      |
| **backendMerchant.ts**  | Campaigns, bank status, stats from Frak backend            | LRU 5s   | backend API (**unused by routes**) |
| **onchain.ts**          | On-chain product/bank/campaign data from indexer           | LRU 5s   | indexer API (ponder)               |
| **mint.ts**             | Product setup code generation                              | None     | Pure crypto (keccak256)            |

## CONVENTIONS

- **GraphQL inline**: queries as template literals in service functions. No separate `.graphql` files. Use `#graphql` pragma for IDE hints.
- **LRU caching**: `lru-cache` with TTL. Cache key = `session.shop` or `normalizedDomain`. `max: 512` entries.
- **Metafield namespace**: `"frak"`. Keys: `modal_i18n`, `appearance`, `merchant_id`. Values: JSON-stringified.
- **Generic helpers**: `metafields.ts` has `readMetafield<T>()` / `writeMetafield<T>()` — reuse for new metafields.
- **Error handling**: try-catch with `console.error`, return `null`/`undefined` on failure. Never throw from services.
- **Tests**: Co-located `*.test.ts` files (6 total). Run with `bun run test`.
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

## WHERE TO LOOK

| Task                    | File                  | Key exports                                                                                                                                                   |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query shop data         | `shop.ts`             | `shopInfo()`, `firstProductPublished()`, `normalizeDomain()`                                                                                                  |
| Read/write metafields   | `metafields.ts`       | `getI18nCustomizations()`, `updateI18nCustomizations()`, `getAppearanceMetafield()`, `updateAppearanceMetafield()`, `getMerchantIdMetafield()`, `getShopId()` |
| Check theme integration | `theme.ts`            | `doesThemeSupportBlock()`, `doesThemeHasFrakActivated()`, `doesThemeHasFrakButton()`, `doesThemeHasFrakWalletButton()`, `getMainThemeId()`                    |
| Manage web pixel        | `webPixel.ts`         | `getWebPixel()`, `createWebPixel()`, `deleteWebPixel()`                                                                                                       |
| Manage webhooks         | `webhook.ts`          | `getWebhooks()`, `createWebhook()`, `deleteWebhook()`, `frakWebhookStatus()`                                                                                  |
| App purchases           | `purchase.ts`         | `startupPurchase()`, `getCurrentPurchases()`, `getPurchase()`                                                                                                 |
| Purchase validation     | `purchase.helpers.ts` | `validatePurchaseAmount()`, `validateBank()`, `parseShopifyGid()`                                                                                             |
| Resolve merchant        | `merchant.ts`         | `resolveMerchantId()`                                                                                                                                         |
| Fetch merchant data     | `backendMerchant.ts`  | `getMerchantCampaigns()`, `getMerchantBankStatus()`, `getMerchantCampaignStats()`                                                                             |
| On-chain data           | `onchain.ts`          | `getOnchainProductInfo()`, `clearOnChainShopCache()`                                                                                                          |
| Setup codes             | `mint.ts`             | `getProductSetupCode()`                                                                                                                                       |

## DEPENDENCY GRAPH

```
shop.ts (foundation — most services depend on it)
  ↑
  ├─ metafields.ts → shopInfo() for shop ID
  ├─ theme.ts → shopInfo() for shop domain
  ├─ purchase.ts → shopInfo() for shop info + ID
  ├─ webhook.ts → shopInfo() for product ID
  ├─ onchain.ts → shopInfo() for normalized domain
  ├─ merchant.ts → shopInfo() for normalized domain
  └─ mint.ts → shopInfo() for normalized domain

merchant.ts (mid-tier — resolves merchantId)
  ↑
  ├─ backendMerchant.ts → resolveMerchantId()
  └─ metafields.ts ← writeMerchantIdMetafield()

webPixel.ts (independent — no service dependencies)
purchase.helpers.ts (independent — pure functions)
```

## ANTI-PATTERNS

- **No client imports**: files live in `services.server/` dir — React Router treeshakes from client bundle.
- **No direct DB calls outside purchase.ts/webhooks.tsx**: purchase.ts owns the purchase table; session adapter owns session table.
- **No throwing**: services return null on error. Let the route decide how to handle missing data.
- **No `.graphql` files**: queries are inline template literals.
