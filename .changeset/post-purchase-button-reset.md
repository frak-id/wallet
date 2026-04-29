---
"@frak-labs/components": patch
---

Fix `<frak-post-purchase>` CTA button not rendering — pull the design-system reset CSS into the component's injected stylesheet by composing `element.button` into the `cta` style. Without it, the browser's native `<button>` rendering overrode the pill styles.
