---
"@frak-labs/components": patch
---

Dash-case attributes now reach every component, and a failed sharing page no longer rejects on the merchant's page.

HTML lowercases attribute names, but components observed their camelCase prop names, so `setAttribute("customer-id", ...)` on an element that had already upgraded was silently dropped, although the README documents that form. Components now observe the dash-case form as well. An attribute that sat inert on a page before this release now takes effect.

The components that open the wallet sharing page do so from a click without awaiting it, so a failed `frak_displaySharingPage` surfaced as an unhandled rejection on the merchant's page. It is now logged to the console instead.
