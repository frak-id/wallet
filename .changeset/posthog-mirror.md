---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Production builds of the SDK now also send a copy of every OpenPanel `track` event to Frak's PostHog project, for a trial next to OpenPanel. It uses a plain `fetch` to `e.frak.id` (no `posthog-js`), drops wallet addresses and transaction hashes, sets no cookie, keeps nothing in storage and ties no event to a person profile. A failed request is ignored and never affects the page or OpenPanel.
