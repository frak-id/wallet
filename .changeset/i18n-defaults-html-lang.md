---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Align the Web Components' built-in i18n default copy with the dashboard's first wording preset, and detect the page's declared language.

- Built-in `buttonShare` / `banner` reward-title defaults now match the dashboard's first preset copy (en + fr).
- New `detectPageLanguage()` util reads `<html lang>` before falling back to the browser language. Language now resolves as `metadata.lang`/config `lang` → `<html lang>` → browser → `en`, so a page authored in a given language renders matching SDK copy even when the visitor's browser is set to another language.
