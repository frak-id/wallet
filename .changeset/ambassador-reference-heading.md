---
"@frak-labs/components": patch
---

`<frak-ambassador>` takes its heading style from hidden reference headings when the host page provides them (`<div hidden data-frak-amb-ref>`), ahead of any other heading on the page. A page with no theme heading of its own, such as the Shopify ambassador page, now matches the shop's title style instead of borrowing a footer or newsletter heading.
