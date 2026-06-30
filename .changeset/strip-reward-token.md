---
"@frak-labs/components": patch
"@frak-labs/core-sdk": patch
---

🐛 Fix `{REWARD}` placeholder handling in SDK copy. `applyRewardPlaceholder` now replaces every `{REWARD}` occurrence (not just the first), and the in-app banner strips the token instead of rendering it literally (in-app mode never resolves a reward).
