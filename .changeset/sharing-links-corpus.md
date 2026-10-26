---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

An empty product `utmContent` no longer hides the caller's `utmContent`: `mergeAttribution` now treats it as absent and uses `perCall.utmContent`. `FrakContextManager.update` now returns `null` for a URL that is not `http:` or `https:` (for example `myapp://…` or `ftp://…`) instead of adding `fCtx` to it, so a share link never opens another app. `FrakContextManager.replaceUrl` is unaffected and still rewrites a `capacitor://` or `file://` page. New `@frak-labs/core-sdk/context/sharing-links-fixtures` export: the share-link and `fCtx` corpus the native SDKs assert against.
