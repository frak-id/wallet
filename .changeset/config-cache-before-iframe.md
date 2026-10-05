---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

`setupClient` reads the visitor's cached merchant config before it creates the wallet iframe, instead of once the iframe has loaded. On a return visit, `<frak-ambassador>` paints the merchant's dashboard text and photo straight away rather than swapping them in over the built-in copy, and the banner and buttons no longer wait for the iframe before they appear (they stay disabled until the client connects).
