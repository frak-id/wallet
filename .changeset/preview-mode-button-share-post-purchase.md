---
"@frak-labs/components": minor
---

Add `preview` attribute to `<frak-button-share>` and `<frak-post-purchase>` (symmetric with `<frak-banner>`). When set, skips the client-ready / RPC gates and no-ops the click handler so theme/block editors (Shopify, WordPress) can render the real web components without a configured Frak client. `<frak-post-purchase>` also gains a `preview-variant` attribute (`"referrer" | "referee"`, defaults to `"referrer"`) to pick which variant is displayed.
