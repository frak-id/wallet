---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Leaving Instagram's in-app browser on iOS works again. Instagram silently drops `x-safari-https://` since its version 417, so `redirectToExternalBrowser` now uses Instagram's own `instagram://extbrowser/` scheme there (Instagram asks the user to confirm, then opens the default browser). It only works from a user tap. Facebook and Android are unchanged. New export: `isInstagramBrowser`.
