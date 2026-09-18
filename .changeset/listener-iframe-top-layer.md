---
"@frak-labs/core-sdk": patch
---

Render the listener overlay in the top layer so merchant widgets stop covering it.

The iframe sat at `z-index: 2000001` as a plain child of `<body>`. Merchant pages routinely pin a widget at 2147483647 — Smile.io's launcher and most cookie banners do — and 2147483647 is the ceiling, so no z-index could clear them. Raising ours to the same value does not help either: at equal z-index the later DOM node wins, and those widgets are injected on `window.load`, after the SDK has already appended the iframe.

`changeIframeVisibility` now promotes the iframe with `popover="manual"` while it is shown and drops the attribute when it is hidden. The top layer sits outside the z-index order, so the overlay covers every widget regardless of what the merchant stacks. The attribute is removed on hide because `[popover]` while closed resolves to `display: none`, and the hidden iframe has to stay live to serve RPC. Promotion does not move the element in the DOM, so the iframe is not reloaded and the listener session survives.

The UA stylesheet dresses a popover as a box — `background-color: Canvas`, `border: solid`, `padding: .25em` — so the shown branch now pins all three inline. The background is the load-bearing one: the listener page is transparent and the merchant page shows through the full-screen overlay, which an opaque iframe would blank out.

Browsers without the Popover API (Safari below 17) keep the previous z-index-only behaviour.
