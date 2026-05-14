---
"@frak-labs/core-sdk": patch
---

Default `directExit` to `true` in `openSso()` when no `redirectUrl` is provided.

Previously the JSDoc claimed `directExit` defaulted to `true` but the value was passed through as `undefined`. The SSO popup ended up stuck on the success screen because both the auto-redirect and the "Redirect now" button became no-ops. Callers that did not pass `directExit` (e.g. embedded apps using popup-only SSO) had to manually pass `directExit: true` to get the popup to close. The default is now applied at the action boundary so popup-only flows work out of the box.
