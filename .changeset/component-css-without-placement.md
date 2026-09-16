---
"@frak-labs/components": patch
---

Inject merchant component CSS on pages where no element carries a `placement`.

`useLightDomStyles` gated injection on `placementId` being present, so a page whose buttons all omit the attribute got no `<style>` at all. The gate was per element but the global tier emits a page-global selector (`frak-button-share .button`), so one placement-carrying button already styled every button on its page — the real gap was per page, not per button. Shopify was the uncovered integration: `referral_button.liquid` emits no `placement`, so nothing triggered injection.

Injection now only requires the CSS itself, keyed by the empty string when there is no placement. Merchants who never saved style values are unaffected: the backend omits `css` when there is no stored `rawCss`, so the hook still returns early and the storefront theme keeps winning.
