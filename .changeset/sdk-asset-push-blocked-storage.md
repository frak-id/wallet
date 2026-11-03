---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Pages where the browser blocks storage (for example Firefox with all cookies blocked) no longer report a false `sdk_iframe_handshake_failed` with reason `asset_push`: blocked storage now simply means there is no backup to restore. When a CSS, i18n or backup push to the wallet really fails, the event now names the `asset` and carries the `error_name` and `error_message`.
