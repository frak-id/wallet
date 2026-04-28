---
"@frak-labs/core-sdk": patch
---

Cut the iframe handshake duration by emitting readiness from the listener as soon as RPC handlers are wired up, instead of waiting for a polled heartbeat.

- SDK heartbeat drops from 1000 ms to 250 ms and is now a fallback discovery ping only (kept as a safety net for SDK/listener version skew during deployments).
- SDK now injects `<link rel="preconnect">` hints for the wallet and backend origins before appending the iframe, so cold-cache partner sites don't pay the DNS/TLS round-trip on the handshake.
- No public API changes. `createIFrameFrakClient`, `setupClient`, `waitForConnection`, and `waitForSetup` keep the exact same contract — they just resolve sooner.
