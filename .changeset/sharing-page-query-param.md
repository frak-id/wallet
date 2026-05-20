---
"@frak-labs/components": patch
---

✨ feat: `?frakAction=share` now auto-opens the full-page sharing UI instead of the legacy embedded-wallet modal, and accepts two extra query params so email tools (Klaviyo, Omnisend, Customer.io …) can deep-link straight into a contextualised share.

- `link` — overrides the URL the sharing page generates outbound shares for. Falls back to the merchant domain when omitted (mirrors `displaySharingPage({ link })`).
- `products` — base64url-encoded `compressJsonToB64` payload of `SharingPageProduct[]`. Surfaces the items the customer just bought as product cards on the sharing page (post-purchase email flow). Malformed / tampered payloads degrade gracefully to "no products".
- `placement` — scopes backend-driven CSS / config to a specific placement, same as the prop on the components.

Internals: the `coerceProductCandidates` / `normalizeProductCandidate` sanitisers previously colocated with `<frak-post-purchase>` move to `@/utils/sharingPageProducts` and are reused by both surfaces, so every untrusted product payload is normalised through the same `http(s)://`-only URL gate before reaching `new URL(...)` downstream.
