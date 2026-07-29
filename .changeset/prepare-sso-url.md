---
"@frak-labs/core-sdk": minor
"@frak-labs/react-sdk": minor
---

Add `prepareSsoUrl()` to open the SSO popup without hitting popup blockers.

`openSso()` has to resolve the client and merchant ids and sign a proof before it can build the URL, so `window.open()` no longer runs in the same tick as the click. Those are usually cache hits, but a cold cache can get the popup blocked.

`prepareSsoUrl()` does that work ahead of time and returns just the URL. `openSso()` now also accepts `{ ssoUrl }`, which it opens immediately — nothing is awaited first, so no blocker heuristic can fire.

```ts
const { ssoUrl } = await prepareSsoUrl(client, { metadata });
// ...later, directly in the click handler:
await openSso(client, { ssoUrl });
```

React gets `usePrepareSsoUrl()`, and `useOpenSso()` accepts either form.

Existing `openSso(client, params)` calls are unaffected.

Note the URL embeds a proof valid for 10 minutes. Past that SSO still opens and the user still logs in; only the anonymous-to-wallet identity link is dropped.
