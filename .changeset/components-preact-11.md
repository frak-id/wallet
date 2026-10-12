---
"@frak-labs/components": minor
---

Components now render with Preact 11. The shared runtime chunk on the CDN is about 0.6 KB smaller gzipped. The custom elements, their attributes and the CDN loader are unchanged.

If you import the Preact components from the npm subpaths (`./ambassador`, `./banner`, `./buttonShare`, `./buttonWallet`, `./openInApp`, `./postPurchase`) and render them inside your own Preact app, that app must be on Preact 11. Two Preact copies on one page break hooks.
