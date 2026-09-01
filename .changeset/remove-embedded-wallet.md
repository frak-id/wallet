---
"@frak-labs/core-sdk": major
"@frak-labs/react-sdk": major
"@frak-labs/components": major
---

Remove the embedded wallet and the modal's sharing step. Every share surface now goes through the sharing page.

The drawer the listener rendered over the partner site is gone, along with the RPC method that opened it:

- `displayEmbeddedWallet()` is removed from `@frak-labs/core-sdk/actions`.
- `frak_displayEmbeddedWallet` is removed from `IFrameRpcSchema`; the listener no longer registers a handler for it.
- The `DisplayEmbeddedWalletParamsType`, `DisplayEmbeddedWalletResultType`, `LoggedInEmbeddedView`, `LoggedOutEmbeddedView`, `EmbeddedViewActionSharing` and `EmbeddedViewActionReferred` types are removed.

Nothing has to change on the merchant side:

- `<frak-button-wallet>` keeps working. It opens the sharing page now, so the tag, its attributes and its Magento/legacy integrations are untouched.
- `<frak-button-share click-action="embedded-wallet">` keeps working and lands on the sharing page, exactly like the retired `"share-modal"` value already did. `clickAction` is typed `"sharing-page"` from now on, but any string is still accepted at runtime, and the resolved value is still reported on the `share_button_clicked` event so you can see which merchants are still on a legacy config. With the embedded wallet gone the setting has no alternative left to select, so the WordPress and PrestaShop plugins stop emitting it entirely.
- `window.FrakSetup.modalWalletConfig` is deprecated and narrowed to `{ metadata?: { position?: "left" | "right" } }`. Only the button position is still read, so integrations that inject it (Magento) keep their configured anchor.

Stored merchant configs are left alone: the backend still accepts and emits `clickAction: "embedded-wallet"` and `components.buttonWallet`, both of which now resolve to the sharing page.

The legacy modal's sharing step is removed with it. It was the last caller of a surface `displaySharingPage` already replaced — `<frak-button-share>` stopped using the modal flow in `@frak-labs/components` 1.0.3 — and production shows no partner traffic reaching it.

This part is a breaking change, hence the major:

- `modalBuilder().sharing()` is removed. Use `displaySharingPage()` for a share flow, or `modalBuilder().reward()` when you only need the success screen.
- `FinalActionType` no longer has its `sharing` variant; a `final` step takes `{ key: "reward" }`. Passing `{ key: "sharing" }` to `displayModal()` is now a type error rather than a silently dead path.

The modal's login, SIWE and transaction steps are unchanged, as are `sendTransaction()` and `siweAuthenticate()`, which build their own steps and never touched the final one.
