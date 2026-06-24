---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

🎯 Add `selectBestReward()` to expose the selected reward's `payoutType` alongside its formatted string, so surfaces can adapt their display per reward type. Web Components now treat percentage-based rewards as "no reward": the `{REWARD}` placeholder is stripped (or the no-reward fallback is used) since a percentage carries no concrete amount to advertise.
