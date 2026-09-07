---
"@frak-labs/core-sdk": minor
"@frak-labs/components": patch
---

Keep sku-only products in the sharing payload, and stop a malformed share URL from unmounting the listener.

`SharingPageProduct.title` becomes optional, and `sanitizeSharingProducts` keeps an entry that carries only scope fields. A `<frak-button-share products='[{"sku":"SHOE-42"}]'>` previously lost its product context entirely — `normalizeSharingProduct` dropped any entry without a title — while the byte-identical attribute on `<frak-banner>`, which goes through `sanitizeProductDetailsList`, kept it. Since every share CTA now routes `products` to the sharing page, that drop also cost the scope on sharing-page reward ranking. A title is a display concern; a sku is a matching one, so the two no longer travel together: the full array reaches reward selection while only titled entries draw a product card.

`FrakContextManager.parse` and `update` now return `null`, and `remove` returns its input unchanged, when handed a URL the platform cannot parse. `update`'s doc comment already promised null-on-failure and did not deliver: `new URL("shop.example.com")` throws `TypeError: Invalid URL`, and `<frak-post-purchase>` derives its share base from a bare host, so the throw landed in a render-phase `useMemo` inside a listener tree that has no ErrorBoundary — blanking the whole Frak iframe on the primary post-purchase CTA rather than just the overlay. `<frak-post-purchase>` also normalises a bare host to `https://` before sharing, and degrades to no link when the value cannot be salvaged.

`minor` on `core-sdk`: `title` moving from required to optional is source-compatible for a caller *writing* a product, but a consumer *reading* `product.title` as a non-optional `string` now gets `string | undefined` and must handle it — a type-level break for anyone who did that, so it is not a patch. `patch` on `components`: no exported signature changes, only the link resolution behind `<frak-post-purchase>`.
