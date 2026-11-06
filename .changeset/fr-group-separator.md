---
"@frak-labs/core-sdk": patch
---

French amounts of 1 000 € or more now show a visible thousands gap. `formatAmount` and `formatAmountParts` (and the reward strings built on them) separate fr-FR thousands with U+00A0 (no-break space) instead of ICU's U+202F (narrow no-break space), which Inter and similar fonts draw too thin to see. The amount still never wraps. Code that matches these strings exactly must expect U+00A0.
