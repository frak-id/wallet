---
"@frak-labs/frame-connector": patch
"@frak-labs/core-sdk": patch
---

`createRpcClient` now handles only the messages sent by its `emittingTransport` window. Before, it accepted any window on the target origin, so two clients on one page each acted on the other's iframe lifecycle events, and a `redirect` with `openInNewTab` could open two tabs. A client whose iframe has left the DOM now detaches itself on its next visibility change, or within 5 minutes, instead of on another iframe's message.
