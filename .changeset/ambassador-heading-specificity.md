---
"@frak-labs/components": patch
---

`<frak-ambassador>` keeps its heading sizes when the host theme styles headings through a scoped rule such as Elementor's `.elementor-kit-51 h1`. That rule outranked the component's own, so on such a WordPress site the hero title took the theme's 120px size and ran under the hero photo.
