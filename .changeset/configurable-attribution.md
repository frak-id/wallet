---
"@frak-labs/core-sdk": patch
---

Allow UTM/attribution defaults from SDK config and backend-driven config. Priority: per-call override > backend config > SDK config > hardcoded fallbacks. Exposes `mergeAttribution` helper and `AttributionDefaults` type (excludes per-product `utmContent`).
