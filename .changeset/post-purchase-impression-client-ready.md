---
"@frak-labs/components": patch
---

Fix `post_purchase_impression` never firing for `<frak-post-purchase>` when it mounts before the Frak client is ready (e.g. preview mode in the vanilla-js example). The impression effect previously ran against an undefined client — a silent no-op that still flipped the "already tracked" ref, suppressing the real event once the client became ready. The effect now gates on client readiness for every path. Restores the `share_cta_seen` website funnel step, which is sourced exclusively from `post_purchase_impression`.
