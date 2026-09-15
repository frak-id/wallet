---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Close the two gaps in sharing entry-point coverage.

`share_button_impression` is new, and fires from both `<frak-button-share>` and `<frak-button-wallet>`. Both tags already reported `share_button_clicked`, so instrumenting only one of them would have produced a click-through rate above 100%. Payload matches `share_button_clicked` (`placement`, `target_interaction`, `has_reward`) so the two divide cleanly, and it fires once per mount — `reward` is deliberately outside the effect's dependencies, since its async arrival would otherwise bill a second impression for one render.

`sharing_page_auto_opened` is new and covers `?frakAction=share`, which opened the sharing page while emitting nothing at all. A `sharing_page_opened` originating from an emailed link was indistinguishable from one caused by a click. It carries `placement`, `has_link` and `has_products`, and fires ahead of the open so the sequence reads the same way a click does.

Every sharing entry point now reports exactly one trigger event, so their relative volumes are directly comparable.
