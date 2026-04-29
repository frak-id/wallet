---
"@frak-labs/components": patch
---

`<frak-button-share>`: route every share click through the full-page sharing UI (`displaySharingPage`) instead of maintaining a parallel modal-flow path. The internal `useShareModal` hook (along with the `ErrorMessage` UI it powered and the `useCopyToClipboard` helper that supported it) is removed; the `clickAction` prop's TypeScript union no longer accepts `"share-modal"`. Existing merchant configs / legacy stored values that still emit `clickAction="share-modal"` keep working — the runtime branch falls through to `openSharingPage` so the share still opens, just on the full-page surface that already supports product cards. Callers wanting the embedded-wallet modal continue to set `clickAction="embedded-wallet"`; that path is untouched.

`openSharingPage`: `metadata` is now only emitted when `targetInteraction` is set, mirroring the conditional spread used for `link` and `products` so the helper never sends an empty `metadata: {}` payload.

`<frak-post-purchase>`: collapse the previous `useCallback(handleShare)` + inline `onClick` arrow (which defeated memoisation) into a single memoised `handleClick` so the click-tracking + `openSharingPage` call live in one named, stable-reference callback.
