---
"@frak-labs/components": patch
---

`<frak-banner>` and `<frak-post-purchase>`: add an optional `imageUrl` prop to override the gift icon displayed on the left of each component. When omitted, the built-in `GiftIcon` keeps rendering as before, so the change is fully backwards-compatible. The custom image is rendered into a fixed-size slot (40×40 for the banner, 80×80 for the post-purchase card) with `overflow: hidden` and `object-fit: contain`, so over- or undersized assets stay visually contained without breaking the surrounding layout. Exposed both as a JS property (`el.imageUrl = "..."`) and as a kebab-case HTML attribute (`<frak-banner image-url="...">` / `<frak-post-purchase image-url="...">`) so server-rendered surfaces (WordPress / Magento / Shopify Liquid) can set it without JavaScript.
