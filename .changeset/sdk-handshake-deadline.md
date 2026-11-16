---
"@frak-labs/core-sdk": patch
"@frak-labs/frame-connector": minor
---

SDK requests no longer wait forever for a wallet iframe that never connects: after 30 seconds they fail with `clientNotConnected`, `waitForConnection` resolves `false`, and `setupClient` detaches the client and returns `undefined` instead of hanging. A response that an `onResponse` middleware cannot process now rejects its request instead of leaving it pending, and closes a `listen()` stream instead of skipping that chunk. `listen()` takes an optional `onError` callback that receives the failure when a stream cannot be sent, the wallet answers with an error, or a response middleware throws. `watchWalletStatus` with a callback now rejects in that case instead of hanging. `cleanup()`, which `client.destroy()` runs, now rejects requests still in flight and reports open streams to `onError` with `clientNotConnected`, and a request made after it fails without being sent, so a provider remount no longer leaves `useWalletStatus` pending forever.
