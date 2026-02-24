---
"@frak-labs/components": patch
"@frak-labs/nexus-sdk": patch
---

Make CDN imports environment-aware using build-time CDN_TAG replacement, ensuring beta releases point to `@beta` tag instead of `@latest`
