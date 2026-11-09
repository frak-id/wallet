---
"@frak-labs/core-sdk": minor
"@frak-labs/components": minor
---

A visitor with unclaimed rewards and no Frak wallet is now reminded on the merchant site, with the amount, a countdown and a link to the wallet install page.

`@frak-labs/core-sdk` adds the `getRewardSummary` action and the `RewardSummary` / `PendingRewardSummary` types. It reads what this browser's anonymous identity earned at the merchant (pending rewards, deadline, whether a wallet is linked) with a signed request, returns `null` on any failure, and gives up after 5 seconds.

`@frak-labs/components` builds the reminder on it:

- `<frak-reward-reminder>` is a floating pill (bottom-left by default, snoozed for the browser session once dismissed) that expands into a card. The CDN loader mounts it by itself when something is waiting. It is on by default; `rewardReminder.enabled: false` in the SDK config or the dashboard turns it off, and `rewardReminder.position` picks the side. Its card text can be overridden with the `heading`, `description` and `cta` attributes.
- `<frak-banner>` gains a `pending` mode (`pendingTitle`, `pendingDescription`, `pendingCta`) that replaces the pill while it is on screen.
- `<frak-ambassador>` shows a "Your rewards" section: a claim prompt above the hero for an unlinked visitor, a recap of what was received and what is on its way for a linked one.
- `<frak-post-purchase>` offers a Claim button next to Share to a referee whose wallet is not linked.

The summary is cached per browser and refetched after a referral, and after the visitor comes back from a claim link.
