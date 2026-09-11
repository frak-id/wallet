# Frak Wallet Core SDK

This SDK lets any dApp or gated-content provider use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with a smoother UX for end users (gas fees are sponsored, paywall options are readable, consumption is tracked).

See the documentation for usage:
- [React client usage](https://docs.frak.id/wallet-sdk/getting-started/react)
- [Core client usage](https://docs.frak.id/wallet-sdk/getting-started/javascript)
- [CDN / Browser usage](https://docs.frak.id/wallet-sdk/getting-started/cdn)

## API Surface

The public surface is exactly what the entry points export, and they are the
only place it is listed:

| Subpath | Entry point |
|---------|-------------|
| `@frak-labs/core-sdk` | `src/index.ts` — client, utilities, types |
| `@frak-labs/core-sdk/actions` | `src/actions/index.ts` |
| `@frak-labs/core-sdk/rewards` | `src/rewards/index.ts` |
| `@frak-labs/core-sdk/identity` | `src/identity/index.ts` |

`package.json` `exports` is authoritative for the remaining (fixture) subpaths.

