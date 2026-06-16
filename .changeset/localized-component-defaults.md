---
"@frak-labs/components": patch
---

🌐 Ship bilingual (en/fr) built-in default copy for the Web Components. Button text, banner copy and aria-labels now follow the resolved language (`metadata.lang` → backend config → browser language → `en`) instead of always rendering English. Resolution is a dependency-free object lookup keyed by language, so the CDN bundle stays light (no i18next runtime). Merchant attribute and backend-config overrides keep precedence over the built-in defaults.
