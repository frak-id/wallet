# Ramp off-ramp in the wallet

Branch `feat/ramp-offramp`, 2026-11-06. Implements step 1 of the [benchmark](benchmark.md#recommendation):
Ramp's widget with the native send flow, plus a CoW EURe → USDC swap before it. Wallet only, no backend.

## What the user sees

Transfer → **Bank account via Ramp** (a second row; the Monerium row stays):

1. **Amount.** EURe or USDC (segmented control, it picks the token the user holds), amount, Max, minimum 10.
   Outside prod only USDC is offered, because CoW has no Arbitrum Sepolia orderbook.
2. **Convert** (EURe only). Live CoW quote ("you get about", "at least" after 0.5% slippage). One passkey prompt:
   a single userOp batches `approve(vaultRelayer)` + `setPreSignature(uid, true)`. The screen polls the order until it fills,
   then hands the bought USDC amount to the widget. If the user stops there, the USDC stays in the wallet and they can
   start again from the USDC tab.
3. **Ramp widget**, embedded (`embedded-mobile`) inside our sheet, off-ramp only, `ARBITRUM_USDC`, amount prefilled.
   When the user clicks "Send with your wallet", the wallet checks the request and sends the USDC itself (`onSendCrypto`). The check:
   the asset must be our USDC, the address valid, the amount in base units, at least 1 USDC and at most the on-chain balance.
   Then comes the biometric confirm, then the transfer userOp. The SDK gets back the mined transaction hash
   (permissionless `sendTransaction` waits for the userOp receipt).
4. **Success** once a transfer was sent and the widget is closed (our close button or "Done"), with the fiat amount from
   `OFFRAMP_SALE_CREATED`.

Code: `apps/wallet/app/module/ramp/` (flow, config, send validation), `apps/wallet/app/module/cowSwap/` (orderbook
client, presign calls, polling; reusable for the later auto-swap module), `common/component/SheetScreen` (the
Monerium sheet layout, now shared). Analytics: `ramp_*` events in `wallet-shared/.../events/ramp.ts`.

## Launch checklist

1. **Ramp partner account** (partner@ramp.network): production and testing `hostApiKey`, off-ramp enabled,
   the native flow (`useSendCryptoCallback`) enabled, and `wallet.frak.id` / `wallet-dev.frak.id` allowed as host origins.
   Ask for EURe on Arbitrum while at it.
2. **Set the secret per stage.** `RAMP_HOST_API_KEY` is an `sst.Secret` with an empty default, baked into the wallet build
   (Dockerfile secret mount, `vite.defines.ts`). Empty means the row is hidden, so merging this is a no-op until the key is set:
   `sst secret set RAMP_HOST_API_KEY <key> --stage <gcp-staging|gcp-production>`, then redeploy the wallet.
   Non-prod builds point the widget at `app.dev.ramp-network.org`, so they need the **testing** key.
3. **Native store release.** `tauri.conf.json` CSP now has `frame-src` for the Ramp origins and `connect-src https://api.cow.fi`.
   That is a `src-tauri` change, so it ships with the next store release, not OTA. Older binaries that still receive the code show
   "Update Frak Wallet to cash out with Ramp" (detected via `securitypolicyviolation`, tracked as `ramp_blocked_by_csp`).
4. **Web headers.** `nginx-security-headers.conf` now allows camera, microphone and payment for self and the two Ramp origins.
   Without this the iframe's KYC camera step is dead. Deploy before (or with) the key.

## Testing

- Unit: CoW client and presign calls, order polling, send validation, amount screen, Transfer row gating.
- Driven in headless Chromium with mocks (verify-wallet `flow`, dummy key): Transfer → Ramp row → minimum and balance checks → widget
  iframe requested with `swapAsset/offrampAsset=ARBITRUM_USDC`, `swapAmount` in base units, `defaultFlow=OFFRAMP`,
  `useSendCryptoCallbackVersion=1`, `userAddress`.
- **No testnet path end to end.** CoW has no Arbitrum Sepolia, and Ramp's testing catalog has no Arbitrum Sepolia USDC.
  The real test is prod with the prod key and ~15 USDC, then ~15 EURe for the swap path.

## Assumptions to confirm on the first real run

- `onSendCrypto`'s `amount` is in base units, like the documented `sale.crypto.amount`. A decimal string is also parsed, and
  anything under one whole token is refused, so a unit mismatch fails closed instead of sending dust.
- The error messages we throw from `onSendCrypto` are shown by the widget.
- KYC camera inside the iframe: on web it needs the header change above. Inside the Tauri WebViews, camera delegation to a
  cross-origin iframe is untested (iOS needs `NSCameraUsageDescription`, Android needs the WebView to grant
  `onPermissionRequest`). If it fails, Ramp's KYC usually offers to continue on another device.
- EU transfers of €1,000 or more may trigger a self-hosted wallet ownership check. Whether Ramp accepts an ERC-1271 signature from
  the Kernel account there is still open (see the benchmark).

## Not in this branch

- Webhook (`offrampWebhookV3Url`) and a cash-out history entry. The sale id is in `rampFlowStore` only for the session.
- Residence-based filtering between providers (the picker in the benchmark), and Mt Pelerin.
- Exact-out swaps: the swap sells the typed EURe amount and the widget gets whatever USDC came out.
