---
"@frak-labs/components": patch
"@frak-labs/core-sdk": patch
---

⚡ Dynamically build the listener iframe `#preload=…` hash from the Frak components actually mounted on the page. Pages without any `frak-*` element skip the preload hint entirely; pages with one or more components push `preload=sharing`. `createIframe` now honours `config.preload` so any `setupClient` consumer benefits from the same behaviour.
