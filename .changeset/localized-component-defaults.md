---
"@frak-labs/components": patch
---

🌐 Ship bilingual (en/fr) built-in default copy for the Web Components. Button text, banner copy and aria-labels now follow the resolved language instead of always rendering English. The language is resolved with this precedence: the merchant's saved dashboard config language (`sdkConfig.lang`) → the integration's `metadata.lang` → the visitor's browser language → `en`. Resolution is a dependency-free object lookup keyed by language, so the CDN bundle stays light (no i18next runtime). Merchant attribute and backend-config overrides keep precedence over the built-in defaults.
