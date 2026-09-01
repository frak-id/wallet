---
"@frak-labs/core-sdk": patch
---

Run the legacy-id migration and the identity keygen once per origin, rather than once per copy of the SDK on the page.

A page routinely holds more than one copy — the CDN `components` bundle beside an npm `@frak-labs/core-sdk` import — and each has its own module state while sharing one `localStorage`. The guards were module-level, so a first load carrying a legacy id sent one `/merge/initiate` + `/merge/execute` pair per copy, and a first visit could generate two keys: the losing copy then signed proofs with the winner's stored key, covering an anonymous id it never reported.

Both now claim a `navigator.locks` lock. Where the API is absent (any non-secure context) behaviour is unchanged.
