# extensions/ — Shopify App Extensions

Three extensions deployed separately via `shopify app deploy`. Different tech stack from main app (Liquid + vanilla JS + Preact).

## STRUCTURE

```
extensions/
├── theme-components/           # Theme app extension (Liquid)
│   ├── blocks/
│   │   ├── listener.liquid     # HEAD block: loads Frak SDK, sets global config
│   │   ├── referral_button.liquid  # Share button web component
│   │   └── banner.liquid       # Referral banner web component
│   ├── locales/                # en.default.json, fr.json
│   ├── assets/customizations.css
│   └── shopify.extension.toml
├── checkout-post-purchase/     # Checkout UI extension (Preact/TSX)
│   ├── src/                    # ThankYou + OrderStatus targets, PostPurchaseCard
│   ├── locales/                # en.default.json, fr.json
│   └── shopify.extension.toml
└── checkout-web-pixel/         # Web pixel extension (TypeScript)
    ├── src/index.ts            # checkout_completed event → POST to Frak backend
    ├── package.json
    └── shopify.extension.toml
```

## DATA FLOW

```
Theme blocks (listener.liquid)
  → Loads Frak SDK from CDN (jsdelivr)
  → Sets window.FrakSetup.config (env origins, shop metadata, appearance)
  → Reads metafields: frak.components_url, frak.appearance, frak.modal_i18n,
    frak.merchant_id, frak.wallet_url, frak.backend_url
  → Writes merchantId to sessionStorage for the checkout pixel fallback

referral_button.liquid / banner.liquid
  → Renders <frak-button-share> / <frak-banner> web components

checkout-web-pixel
  → Listens for checkout_completed event
  → Reads frak-wallet-interaction-token (sessionStorage) + frak-client-id (localStorage)
  → Bails unless one of them, a merchantId, and order id/customer id/token are all present
  → POSTs {customerId, orderId, token, merchantId} to <backendUrl>/user/track/purchase

checkout-post-purchase
  → Thank You + Order Status targets render PostPurchaseCard
  → Reads shop metafields (merchant_id, wallet_url, appearance) + frak_i18n metaobject
```

## THEME-COMPONENTS

**Block types**: listener (HEAD), referral_button (product section), banner (any section).

**listener.liquid** is the critical block — without it, no Frak SDK loads. Config comes from:

- Block settings (logo, modal language, custom JS)
- Shop metafields (`frak.components_url`, `frak.appearance`, `frak.modal_i18n`, `frak.merchant_id`, `frak.wallet_url`, `frak.backend_url`)
- Shop object (name, logo, locale)

**Customization flow**: merchant configures via Shopify admin metafields → `listener.liquid` reads at render time → passes to Frak SDK via `window.FrakSetup`.

## CHECKOUT-WEB-PIXEL

- Runs in `strict` runtime context
- Privacy: analytics=false, marketing=false, sale_of_data=disabled
- Network access enabled (for backend POST)
- `backendUrl` + `merchantId` come from extension settings; `backendUrl` falls back to `https://backend.frak.id`, `merchantId` to the `frak-merchant-id` sessionStorage value written by `listener.liquid`
- `keepalive: true` on fetch to survive page unload
- Auth: `x-wallet-sdk-auth` (interaction token) and/or `x-frak-client-id` (client id) — at least one is required

## MAIN APP INTEGRATION

Extensions are validated during onboarding (7-step wizard):

- **Step 2**: Web pixel must exist (`webPixel.ts` → `getWebPixel()`)
- **Step 5**: listener block must be active in theme (`theme.ts` → `doesThemeHasFrakActivated()`)
- **Step 6**: referral button must be in the product template (`theme.ts` → `doesThemeHasFrakButton()`)
- **Step 7**: banner block must be enabled somewhere (`theme.ts` → `doesThemeHasFrakBanner()`)

Theme detection works by parsing theme JSON templates and matching block type substrings like `/blocks/referral_button/` and `/blocks/banner/`.

## CONVENTIONS

- **Block naming**: snake_case (`referral_button`, not `referralButton`)
- **Locales**: `en.default.json` is source of truth. Match keys when adding translations.
- **Extension API version**: matches main app (`2026-04`)
- **Monorepo workspace**: `checkout-post-purchase` and `checkout-web-pixel` are workspaces of `apps/shopify` (`extensions/*`), not of the repo root. `theme-components` has no `package.json` — it is pure Liquid and is not a workspace.
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

## ANTI-PATTERNS

- **Don't hardcode the origins** — read the `frak.wallet_url` + `frak.backend_url` metafield pair. Default the pair as a whole; defaulting one half alone can cross a dev wallet with the production backend.
- **Don't bypass sessionStorage** — checkout pixel depends on token written by theme blocks.
- **Don't add analytics/marketing tracking** — privacy settings explicitly disable it.

## GOTCHAS

- **Origins come from metafields, defaulted as a pair**: `listener.liquid` reads `frak.wallet_url` + `frak.backend_url`, written together by the app (`ensureEnvMetafields`) on admin load. A shop synced before `backend_url` existed has only the wallet half, so the Liquid falls back to the production pair wholesale rather than mixing stages.
- **No SDK version pinning**: Frak SDK loaded from CDN without version lock (`@frak-labs/components` = latest). Could break if SDK changes class names or API.
- **CSS class fragility**: `customizations.css` hides `.nexus-modal-provided` — will break if Frak SDK renames the class.
- **Silent failure**: Checkout pixel silently returns if interaction token missing or checkout data incomplete. No error logging, no retry.
