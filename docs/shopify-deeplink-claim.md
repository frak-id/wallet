# Shopify Deep-Link Claim (Layer 3)

Ad-blocker fallback for purchase-to-identity linking when both the checkout pixel and cart-attribute approaches fail.

## Problem

Layer 1 (cart attributes → webhook) and Layer 2 (checkout pixel) require the Frak SDK to have loaded at least once before checkout. If aggressive blockers prevent the SDK from ever loading, no identity data reaches the backend.

## Idea

Serve a **signed deep-link** on the thank-you page, order-status page, and order confirmation email. Clicking it opens the Frak wallet, triggers SSO if needed, and attributes the purchase.

```
https://wallet.frak.id/claim?anonId={clientId}&merchantId={merchantId}&orderId={orderId}&sig={hmac}
```

## Components to Build

### 1. Checkout UI Extension (`checkout-claim-link`)

- **Type**: `checkout_ui_extension`
- **Targets**: `purchase.thank-you.block.render`, `customer-account.order-status.block.render`
- **Behavior**: Render a "Claim your reward" button/link
- **Data sources**:
  - `orderId` from `OrderConfirmationApi`
  - `merchantId` from extension settings or `appMetafields`
  - `clientId` from `StandardApi.attributes` (cart attributes, if Layer 1 populated them)
- **Note**: Extension runs in Shopify sandbox — ad-blocker resistant. Cannot access storefront `localStorage`/`sessionStorage` directly.

### 2. Wallet Claim Route (`apps/wallet`)

- New route: `/claim`
- Parses deep-link params (`anonId`, `merchantId`, `orderId`, `sig`)
- Verifies HMAC signature
- If user not authenticated → redirect to SSO (WebAuthn)
- On auth → calls `POST /user/track/purchase` with wallet identity + order data
- Displays confirmation or reward status

### 3. Backend HMAC Signing

- On webhook receipt, generate signed claim URL
- Write URL to Shopify order metafield via Admin API (`frak.claim_link`)
- Requires `write_orders` scope added to the Shopify app

### 4. Email Template Integration

- Order metafield `frak.claim_link` can be referenced in Shopify email templates:
  ```liquid
  {% if order.metafields.frak.claim_link %}
    <a href="{{ order.metafields.frak.claim_link.value }}">Claim your reward</a>
  {% endif %}
  ```
- Alternatively, inject via Shopify Flow → custom email action

## Design Decisions (pending product review)

- Always show the component vs conditional (only when unclaimed)?
- Button copy and styling
- Auto-redirect vs explicit click
- Email template customization approach (native Liquid vs Shopify Flow)
- Whether to show reward amount preview before claim
