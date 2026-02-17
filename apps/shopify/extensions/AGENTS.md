# extensions/ — Shopify App Extensions

Two extensions deployed separately via `shopify app deploy`. Different tech stack from main app (Liquid + vanilla JS).

## STRUCTURE

```
extensions/
├── theme-components/           # Theme app extension (Liquid)
│   ├── blocks/
│   │   ├── listener.liquid     # HEAD block: loads Frak SDK, sets global config
│   │   ├── referral_button.liquid  # Share button web component
│   │   └── wallet_button.liquid    # Wallet button web component
│   ├── locales/                # en.default.json, fr.json
│   ├── assets/customizations.css
│   └── shopify.extension.toml
└── checkout-web-pixel/         # Web pixel extension (TypeScript)
    ├── src/index.ts            # checkout_completed event → POST to Frak backend
    ├── dist/                   # Compiled output (minified JS)
    ├── package.json
    └── shopify.extension.toml
```

## DATA FLOW

```
Theme blocks (listener.liquid)
  → Loads Frak SDK from CDN (jsdelivr)
  → Sets window.FrakSetup config (wallet URL, shop metadata, appearance)
  → Reads metafields: frak.appearance, frak.modal_i18n, frak.merchant_id

referral_button.liquid / wallet_button.liquid
  → Renders <frak-button-share> / <frak-button-wallet> web components
  → User interaction → stores token in sessionStorage

checkout-web-pixel
  → Listens for checkout_completed event
  → Reads interaction token from sessionStorage
  → POSTs to backend.frak.id/interactions/listenForPurchase
```

## THEME-COMPONENTS

**Block types**: listener (HEAD), referral_button (product section), wallet_button (body).

**listener.liquid** is the critical block — without it, no Frak SDK loads. Config comes from:

- Block settings (wallet URL, language, logo, wallet button position, custom JS)
- Shop metafields (`frak.appearance`, `frak.modal_i18n`, `frak.merchant_id`)
- Shop object (name, logo, locale)

**Customization flow**: merchant configures via Shopify admin metafields → `listener.liquid` reads at render time → passes to Frak SDK via `window.FrakSetup`.

## CHECKOUT-WEB-PIXEL

- Runs in `strict` runtime context
- Privacy: analytics=false, marketing=false, sale_of_data=disabled
- Network access enabled (for backend POST)
- `keepalive: true` on fetch to survive page unload
- Auth: `x-wallet-sdk-auth` header with interaction token

## MAIN APP INTEGRATION

Extensions are validated during onboarding (6-step wizard):

- **Step 2**: Web pixel must exist (`webPixel.ts` → `createWebPixel()`)
- **Step 5**: listener block must be active in theme (`theme.ts` → `doesThemeHasFrakActivated()`)
- **Step 6**: referral or wallet button must be in theme (`theme.ts` → `doesThemeHasFrakButton()`)

Theme detection works by parsing theme JSON templates and regex-matching block type strings like `/blocks/referral_button/`.

## CONVENTIONS

- **Block naming**: snake_case (`referral_button`, not `referralButton`)
- **Locales**: `en.default.json` is source of truth. Match keys when adding translations.
- **Extension API version**: matches main app (`2025-01`)
- **Monorepo workspace**: extensions are npm workspaces in root `package.json`
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

## ANTI-PATTERNS

- **Don't hardcode wallet URL** — use block settings or metafield. Currently `https://wallet.frak.id` in listener.liquid.
- **Don't bypass sessionStorage** — checkout pixel depends on token written by theme blocks.
- **Don't add analytics/marketing tracking** — privacy settings explicitly disable it.

## GOTCHAS

- **No env switching for URLs**: Wallet URL (`wallet.frak.id`) and backend endpoint (`backend.frak.id`) are hardcoded in Liquid/TypeScript. Dev and production extensions hit the same backends.
- **No SDK version pinning**: Frak SDK loaded from CDN without version lock (`@frak-labs/components` = latest). Could break if SDK changes class names or API.
- **CSS class fragility**: `customizations.css` hides `.nexus-modal-provided` and `.frak-wallet-logoFrak` — will break if Frak SDK renames classes.
- **Silent failure**: Checkout pixel silently returns if interaction token missing or checkout data incomplete. No error logging, no retry.
