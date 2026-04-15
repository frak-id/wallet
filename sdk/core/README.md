# Frak Wallet Core SDK

This SDK help any dApps, or gated content provider, use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with smoother UX for your end-users (pay for his gas fees, check the paywall options, track his consumption etc.)

Checkout our documentation for more information's about the usage:
- [React client usage](https://docs.frak.id/wallet-sdk/getting-started/react)
- [Core client usage](https://docs.frak.id/wallet-sdk/getting-started/javascript)
- [CDN / Browser usage](https://docs.frak.id/wallet-sdk/getting-started/cdn)

## API Surface

The Core SDK exports 111 functions, types, and utilities organized into four categories:

### Client

| Export | Purpose |
|--------|---------|
| `createIFrameFrakClient` | Initialize iframe-based Frak client for wallet communication |
| `setupClient` | Configure client with blockchain and transport settings |
| `DebugInfoGatherer` | Utility class for collecting debug information |

### Actions

| Export | Purpose |
|--------|---------|
| `displayModal` | Show wallet modal for user interactions |
| `displayEmbeddedWallet` | Render embedded wallet view within your app |
| `getMerchantInformation` | Fetch merchant data including rewards and tiers |
| `openSso` | Trigger single sign-on flow in popup window |
| `prepareSso` | Prepare SSO parameters before opening popup |
| `processReferral` | Handle referral code processing and validation |
| `referralInteraction` | Track referral-related user interactions |
| `sendInteraction` | Send user interaction events to wallet |
| `trackPurchaseStatus` | Monitor purchase completion status |
| `watchWalletStatus` | Subscribe to wallet connection and balance updates |
| `modalBuilder` | Helper to construct multi-step modal flows |
| `sendTransaction` | Wrapper for transaction signing and submission |
| `siweAuthenticate` | Sign-in with Ethereum authentication flow |

### Utilities

| Export | Purpose |
|--------|---------|
| `sdkConfigStore` | Reactive config singleton — resolve, cache, and subscribe to merchant config |
| `computeLegacyProductId` | Convert product ID to legacy format |
| `triggerDeepLinkWithFallback` | Open deep link with mobile fallback |
| `base64urlEncode` / `base64urlDecode` | URL-safe base64 encoding/decoding |
| `compressJsonToB64` / `decompressJsonFromB64` | JSON compression utilities |
| `trackEvent` | Send analytics events |
| `getClientId` | Retrieve unique client identifier |
| `getBackendUrl` | Get configured backend URL |
| `formatAmount` | Format token amounts with decimals |
| `getCurrencyAmountKey` | Generate currency-specific cache key |
| `getSupportedCurrency` | Check currency support |
| `getSupportedLocale` | Validate locale availability |
| `createIframe` / `findIframeInOpener` | Iframe DOM helpers |
| `FrakContextManager` | Manage SDK context lifecycle |
| `generateSsoUrl` | Build SSO redirect URL |

### Types

Core SDK exports 40+ TypeScript types including:

`FrakClient`, `FrakWalletSdkConfig`, `SendInteractionParamsType`, `DisplayModalParamsType`, `WalletStatusReturnType`, `GetMerchantInformationReturnType`, `DisplayEmbeddedWalletParamsType`, `SendTransactionReturnType`, `SiweAuthenticateReturnType`, `OpenSsoParamsType`, `PrepareSsoParamsType`, `TrackArrivalParams`, `UtmParams`, `Currency`, `Language`, `FrakContext`, `IFrameRpcSchema`, and more.

