---
"@frak-labs/components": patch
---

Each web component's CDN chunk now carries only its own default strings instead of every component's copy in the shared `jsxRuntime` chunk, which drops from 13.9 KB to 9.0 KB gzipped; `@frak-labs/components/i18n/defaults` keeps its shape.
