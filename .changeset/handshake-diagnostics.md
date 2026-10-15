---
"@frak-labs/core-sdk": patch
---

`sdk_iframe_handshake_failed` with `reason: "timeout"` now says why: whether the wallet listener ever answered (`listener_seen`), the error that stopped it booting (`listener_error`), the page state over the wait (`visibility_state`, `was_hidden`, `online`) and how long the iframe took to load (`iframe_load_ms`). A connection that lands after the timeout is still reported, as `sdk_iframe_connected` with `after_timeout: true`.
