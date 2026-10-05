---
"@frak-labs/components": patch
---

`<frak-ambassador>` stays readable on dark and unusual themes: when the sampled (or default) accent would vanish into the page, its buttons and figures take the page's text colour instead, and on a dark page the hero reward card turns dark so its caption shows. It also follows the theme's heading font and letter case, ignores Shopify's country picker when looking for the brand button, and no longer shrinks its title to body size on themes whose bare `h1` is unstyled.
