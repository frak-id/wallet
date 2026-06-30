---
"@frak-labs/components": patch
"@frak-labs/core-sdk": patch
---

🎁 Let merchants replace the built-in gift icon on the post-purchase card and the referral banner with a custom illustration. The image is now read from the resolved SDK config (`components.postPurchase.imageUrl` / `components.banner.imageUrl`), so a dashboard-configured icon applies automatically; an explicit `imageUrl` prop still takes precedence, and both fall back to the default gift icon when unset.
