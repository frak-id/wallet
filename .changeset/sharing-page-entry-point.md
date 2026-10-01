---
"@frak-labs/core-sdk": minor
"@frak-labs/components": patch
---

The sharing page now reports which component opened it, and `<frak-ambassador>` reports an impression.

`displaySharingPage` accepts an optional `metadata.entryPoint` (`"share_button" | "post_purchase" | "ambassador" | "auto_open"`), exported as `SharingPageEntryPoint`. It is analytics only: the listener reports it as `entry_point` on `sharing_page_opened` and `sharing_page_viewed`. The share and wallet buttons, the post-purchase card, the ambassador page and the `?frakAction=share` auto-open each set their own value. A direct `displaySharingPage` call that omits it reports none.

`<frak-ambassador>` emits `ambassador_impression` once per mount, after the client is ready and the backend config has resolved. A merchant that turns out to be `hidden` is never counted.
