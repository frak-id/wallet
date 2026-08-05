// TODO: dead preview surface — decide keep or delete.
//
// Nothing in the two consuming apps (`apps/business`, `apps/shopify`, the only
// packages that depend on `@frak-labs/ui-preview`) renders any of these:
//
//   - `SharingPreview`        (`./sharing-page`,    ~220 lines + 230 of styles)
//   - `SharingSuccessPreview` (`./sharing-success`)
//   - `SocialPreview`         (`./social`)
//   - `parseMarkdown`         (`./utils/variables`)
//
// `replaceVariables` from that same module IS live — `./sdk-components` uses it
// — it just does not need to be part of the public surface.
//
// `SharingPreview` is the expensive one: it is a second, drifting
// implementation of `packages/wallet-shared/src/sharing/component/SharingPage`,
// reading the same `sdk.sharingPage.*` keys. It cannot be deduplicated by
// importing the real component, because `wallet-shared` is importable only by
// `apps/wallet` and `apps/listener` and this package is consumed by
// `business`/`shopify`. So every change to the real sharing page has to be
// mirrored here by hand, and the sharing-page refactor already had to: the
// i18n step keys were split into `{ title, description }`, and this file's copy
// of the credit-card amount regex is now the only one left in the repo.
//
// Keep it only if a dashboard preview of the sharing page is actually planned.
// If not, deleting `./sharing-page` alone drops ~450 lines and removes the
// mirroring obligation.

// Sharing page preview (header, card, reward, stepper, footer)

// Explorer phone preview (CSS phone-frame mockup)
export type { ExplorerPhonePreviewProps } from "./explorer-phone";
export { ExplorerPhonePreview } from "./explorer-phone";
// Shared preview wrapper (disabled affordance)
export { previewWrap } from "./preview-frame";
export type {
    BannerPreviewProps,
    PostPurchasePreviewProps,
    ShareButtonPreviewProps,
} from "./sdk-components";
// SDK component previews
export {
    BannerPreview,
    PostPurchasePreview,
    ShareButtonPreview,
} from "./sdk-components";
export type { SharingPreviewProps } from "./sharing-page";
export { SharingPreview } from "./sharing-page";
export type { SharingSuccessPreviewProps } from "./sharing-success";
// Sharing success preview (post-share confirmation)
export { SharingSuccessPreview } from "./sharing-success";
// Social preview
export { SocialPreview } from "./social";
// Utilities
export { parseMarkdown, replaceVariables } from "./utils/variables";
