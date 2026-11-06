---
"@frak-labs/core-sdk": patch
"@frak-labs/components": minor
---

`<frak-ambassador>` takes its accent colour from the merchant's dashboard setting (`components.ambassador.accentColor`, `#rrggbb`). It outranks the colour sampled from the host theme; a `--frak-amb-accent` the merchant sets in CSS still outranks it. Button text stays white while it reads at 3:1 on the accent and turns black below that, and a light accent on a light page no longer colours the reward figures. Without the setting, nothing changes.
