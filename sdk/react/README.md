# Frak Wallet React SDK

This SDK help any dApps, or gated content provider, use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with smoother UX for your end-users (pay for his gas fees, check the paywall options, track his consumption etc.)

Checkout our documentation for more information's about the usage:
- [React client usage](https://docs.frak.id/wallet-sdk/getting-started/react)
- [Core client usage](https://docs.frak.id/wallet-sdk/getting-started/javascript)
- [CDN / Browser usage](https://docs.frak.id/wallet-sdk/getting-started/cdn)

## Hooks

| Hook | Purpose |
|------|---------|
| `useWalletStatus` | Watch wallet connection state and account information |
| `useDisplayModal` | Trigger SDK modal display for user interactions |
| `useSiweAuthenticate` | SIWE (Sign-In with Ethereum) authentication flow |
| `useOpenSso` | Open SSO authentication flow |
| `usePrepareSso` | Prepare SSO data before opening authentication |
| `useSendTransactionAction` | Send blockchain transaction actions |
| `useGetMerchantInformation` | Query merchant info and available rewards |
| `useReferralInteraction` | Auto-submit referral interactions |
| `useFrakClient` | Access the FrakClient instance |
| `useFrakConfig` | Access SDK configuration |

## Providers

Wrap your application root with these providers:

- **`FrakConfigProvider`** — SDK configuration context. Required at app root.
- **`FrakIFrameClientProvider`** — Iframe client context for SDK communication.

Both providers export TypeScript types: `FrakConfigProviderProps`, `FrakIFrameClientProps`.

