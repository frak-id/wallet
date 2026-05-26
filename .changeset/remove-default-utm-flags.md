---
"@frak-labs/core-sdk": patch
---

Stop injecting default UTM flags when building attribution URLs. Previously `FrakContextManager.update` (and anything routing through `applyAttributionParams`) auto-filled `utm_medium=referral`, `via=frak`, and on V2 contexts also `utm_campaign` / `ref` from the context payload. This polluted merchant analytics and overrode codes integrators wanted to own.

Only `utm_source` keeps its `frak` default; `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `via`, and `ref` are now opt-in via `AttributionParams`.
