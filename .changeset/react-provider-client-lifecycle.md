---
"@frak-labs/core-sdk": minor
"@frak-labs/react-sdk": patch
---

`FrakIFrameClientProvider` now creates a fresh client when it mounts again, instead of reusing the previous one bound to a removed iframe, and detaches its client when it unmounts. `client.destroy()` accepts `{ detachOnly: true }` to stop a client's listeners and timers while keeping its iframe and the cached merchant config. A client whose iframe has left the DOM detaches itself on the next lifecycle message instead of acting on it.
