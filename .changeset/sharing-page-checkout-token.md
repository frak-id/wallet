---
"@frak-labs/core-sdk": minor
"@frak-labs/components": minor
---

Carry the order's checkout token through `displaySharingPage`, so `<frak-post-purchase>` reaches the same identity fallback the Shopify checkout extension already used.

`DisplaySharingPageParamsType` gains an optional `checkoutToken`, `openSharingPage` forwards it, and `<frak-post-purchase>` sends the `token` it already holds for purchase tracking. The listener's sharing page then resolves the anonymous id from the order when the SDK holds none, and builds its install link from the token instead of returning nothing — a cleared or ad-blocked `localStorage` previously left that CTA dead.

Only a *proven* id travels: an `anonymousId` without its `frak-install-v1` proof is refused by `install-code/generate`, so the token is preferred over it rather than the reverse, and the two are never sent together.

Scope worth knowing: this fixes the install CTA for that buyer, not the share link. When the order resolves to a server-minted (`frakmint_`) id, the FrakContext v2 codec — which encodes UUIDs only — cannot carry it, so the share link stays empty. Such an id is now discarded at the client boundary rather than passed on to die inside the encoder.

The token is a bearer credential: `GET /user/identity/order-client` is unauthenticated, and `install_codes.checkout_token` is stored as plain text and is not single-use. This change widens the set of platforms that put it in a URL — from Shopify's checkout token to WooCommerce and PrestaShop, both of which build theirs from the order key (`<order_key>_<id>` and `<secure_key>_<id>`). On WooCommerce that same key already gates order lookup by URL, so the value is reused rather than newly exposed. Same exposure class as the existing Shopify surface, more surfaces.
