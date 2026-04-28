---
"@frak-labs/components": patch
---

`<frak-post-purchase>`: forward an optional `products` array to the full-page sharing UI so referrers see cards for the items they just bought instead of only a generic share screen. Accepts either a `SharingPageProduct[]` (set imperatively, `el.products = [...]`) or a JSON-stringified array (set as an HTML attribute by server-rendered surfaces such as the WordPress / Magento plugins). Each entry is sanitised on the SDK boundary — `title` is required, and `imageUrl` / `link` are kept only when they parse as `http(s)://` URLs — so a malformed `link` cannot crash the listener-side `new URL(...)` call and a `javascript:` URL cannot reach `imageUrl` / `link` consumers downstream.

Internally, the share CTA now opens via `displaySharingPage` (the full-page sharing flow) instead of `modalBuilder().sharing()` (the modal flow). The full-page surface is the only one that renders product cards; this is also why the modal-flow share keeps working unchanged for `<frak-button-share>`. The `openSharingPage` helper grew an optional third `options?: { link?, products? }` argument so callers can opt in without touching the existing `(targetInteraction, placement)` signature.
