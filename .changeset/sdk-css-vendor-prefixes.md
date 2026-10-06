---
"@frak-labs/components": patch
---

Component styles are now vendor-prefixed for the SDK's browser floor (Safari 15.4). `<frak-banner>` in in-app browser mode keeps its backdrop blur on iOS 15.4–17, where only `-webkit-backdrop-filter` is supported.
