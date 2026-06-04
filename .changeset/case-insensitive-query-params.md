---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

🐛 fix: match UI-triggering query-param keys case-insensitively, so links whose case is mangled in transit (email tools / browsers that lowercase URLs) still work.

- `@frak-labs/components`: `?frakAction=share` now resolves regardless of case on both the key and the `share` value (`?FrakAction=Share`, `?frakaction=share`, …). The companion `link` / `placement` / `products` params are read and stripped case-insensitively too.
- `@frak-labs/core-sdk`: `FrakContextManager` reads, updates and removes the `fCtx` referral key case-insensitively (`fctx`, `FCTX`, …); an exact-case key still wins when both variants are present. The encoded value is untouched — a base64url payload lowercased in transit remains unrecoverable, so this only covers key-casing.
- New shared helpers `getQueryParamCaseInsensitive` / `deleteQueryParamCaseInsensitive` are exported from `@frak-labs/core-sdk` and back the matching above, keeping a single source of truth across the SDK packages.
