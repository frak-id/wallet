---
"@frak-labs/components": patch
---

Pin the CDN shim to the exact version it was built from.

`cdn/components.js` — the file every merchant page loads — dynamically imported `@latest/cdn/loader.js?v=<timestamp>` at runtime. jsDelivr serves floating tags with a 7-day browser cache, so a returning visitor could keep an old shim for up to a week after a release. That stale `loader.js` then requests its hashed chunks under `@latest`, which by then resolves to the new release — where those chunk names no longer exist — so the import 404s on the merchant's page.

The shim now imports `@<published version>/cdn/loader.js`, with no query string. Every file downstream of it is now an exact, immutable jsDelivr URL, so a cached shim always resolves a loader and chunk set that actually shipped together. No integrator-facing change: the merchant snippet and CDN URL are unchanged.
