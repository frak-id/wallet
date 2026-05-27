---
"@frak-labs/components": patch
"@frak-labs/core-sdk": patch
---

Drop the `useReward` / `use-reward` opt-in on `<frak-button-share>`. The
button now fetches the estimated reward whenever `text` contains the
`{REWARD}` placeholder, and uses `no-reward-text` (or strips the
placeholder) as the fallback. Same behaviour for placement configs:
`components.buttonShare.useReward` is no longer read.

This removes a footgun where `<frak-button-share use-reward …>` passed
the empty-string HTML attribute value to a strict `=== true` check, so
the placeholder stayed literal on real merchant pages despite the
JSX-driven unit tests passing.
