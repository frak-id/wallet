# Frak Legacy SDK

> :warning: **Retired.** Nothing here connects to a wallet. Use [`@frak-labs/core-sdk`](../core) or [`@frak-labs/react-sdk`](../react).

The package still publishes so the npm name stays ours and
`cdn.jsdelivr.net/npm/@frak-labs/nexus-sdk@latest/dist/bundle/bundle.js` keeps resolving instead of 404ing.
What it serves is a ~300 byte stub of the `NexusSDK` global.

**Every export returns a promise that never settles.** That is the whole design, and it is load-bearing:
the integrations still loading this bundle chain their setup off the first call and log from their own
failure branches. Resolving runs their error paths (`console.error("Failed to create Frak iframe")`),
rejecting runs their catch blocks, and resolving *successfully* runs their success paths — which log too.
Stalling is the only outcome that is silent. Verified against the live integration: zero console output,
no throws, no DOM writes, no network.

Do not "fix" these stubs by resolving them, and do not add real exports.
