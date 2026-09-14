# Frak Wallet React SDK

This SDK lets any dApp or gated-content provider use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with a smoother UX for end users (gas fees are sponsored, paywall options are readable, consumption is tracked).

See the documentation for usage:
- [React client usage](https://docs.frak.id/wallet-sdk/getting-started/react)
- [Core client usage](https://docs.frak.id/wallet-sdk/getting-started/javascript)
- [CDN / Browser usage](https://docs.frak.id/wallet-sdk/getting-started/cdn)

## Hooks

Every hook is a TanStack Query/Mutation wrapper around a `@frak-labs/core-sdk`
action of the same name. `src/hook/index.ts` is the authoritative list.

## Providers

Wrap your application root with these providers:

- **`FrakConfigProvider`** — SDK configuration context. Required at app root.
- **`FrakIFrameClientProvider`** — Iframe client context for SDK communication.

Both providers export TypeScript types: `FrakConfigProviderProps`, `FrakIFrameClientProps`.

