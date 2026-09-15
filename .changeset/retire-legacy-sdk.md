---
"@frak-labs/nexus-sdk": minor
---

Retire `@frak-labs/nexus-sdk`. The package still publishes, but it no longer connects to a wallet.

The bundle was a flat pass-through: `export * from "@frak-labs/core-sdk"` plus `/actions`, the
`createIFrameNexusClient` alias, and a document-ready hook applying a hard-coded override for one merchant
host. All of it is gone, and the `@frak-labs/core-sdk` dependency with it — `dist/bundle/bundle.js` goes from
92 kB to ~300 bytes.

What remains is an inert `NexusSDK` global exposing `createIframe`, `createIFrameNexusClient`,
`createIFrameFrakClient`, `displayModal`, `watchWalletStatus` and `referralInteraction`. Every one returns a
promise that never settles, so pages still loading this script by tag neither throw nor log: their setup
chains stall at the first call instead of reaching their own error branches. No wallet iframe is created, no
interaction is tracked, no referral is processed, nothing is written to storage or the DOM.

The stalling is deliberate and load-bearing. Resolving these stubs runs the integrations' failure paths
(`console.error("Failed to create Frak iframe")`), rejecting runs their catch blocks, and resolving
successfully runs their success paths, which log on every page load. Do not make them settle.

No migration is offered. Use `@frak-labs/core-sdk` (CDN global `FrakSDK`) or `@frak-labs/react-sdk`.
