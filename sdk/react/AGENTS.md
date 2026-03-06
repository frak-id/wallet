# sdk/react

React hooks and providers wrapping `core-sdk`. NPM only (no CDN).

## Structure

```
src/
├── hook/             # 10 public hooks + helpers
├── provider/         # FrakConfigProvider, FrakIFrameClientProvider
└── index.ts          # Barrel exports
```

## Hooks (10 public)

| Hook | Purpose |
|------|---------|
| `useFrakClient` | Access FrakClient instance |
| `useFrakConfig` | Access SDK config |
| `useWalletStatus` | Wallet connection state |
| `useDisplayModal` | Show SDK modals |
| `useSiweAuthenticate` | SIWE authentication |
| `useOpenSso` | SSO flow |
| `usePrepareSso` | Prepare SSO data |
| `useSendTransactionAction` | Send blockchain transaction actions |
| `useGetMerchantInformation` | Merchant info query |
| `useReferralInteraction` | Referral interaction helper |

## Conventions

- **TanStack Query**: All data hooks use React Query v5.
- **Peer Deps**: React 18+, TanStack Query 5+, Viem 2+.
- **Composition**: Hooks compose from `core-sdk` actions.

## Testing

- Vitest with jsdom (`react-sdk-unit` project).
- Mock TanStack Query with `@frak-labs/test-foundation`.
- Use `renderHook` for testing.

## Notes

- Requires `FrakConfigProvider` at app root.
- Depends on `@frak-labs/core-sdk`.

