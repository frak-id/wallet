---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

The CDN bootstrap now reports `sdk_init_failed` when `initFrakSdk` fails, for example when `window.FrakSetup.config` is missing. The event was never sent before, because it went through a client that does not exist after a failed init. It is now sent once per failed attempt, with `reason`, `config_missing` and the page `domain`. `trackEvent` accepts any object that carries an `openPanel`.
