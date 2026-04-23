---
"@frak-labs/components": patch
---

Fix `<frak-banner>` rendering unstyled in in-app browser mode. The InAppBanner vanilla-extract styles (`inAppBanner_container`, `inAppBanner_cta`, `inAppBanner_closeButton`, etc.) were compiled but never aggregated into the `cssSource` string injected by `useLightDomStyles`, because `Banner.css.ts` did not reference `inAppBanner.css.ts` in its vanilla-extract dependency graph. Added a side-effect import of `@frak-labs/design-system/styles/inAppBanner` so the plugin now bundles the missing CSS into the banner's runtime-injected `<style>` tag.
