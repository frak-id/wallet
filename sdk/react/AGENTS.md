# sdk/react

React hooks and providers for Frak SDK. Published as `@frak-labs/react-sdk`.

## Structure

```
src/
├── hook/             # React hooks (10 hooks + helpers)
│   ├── useFrakClient.ts
│   ├── useWalletStatus.ts
│   ├── useDisplayModal.ts
│   ├── helper/       # Hook helpers
│   ├── utils/        # Hook utilities
│   └── ...
├── provider/         # Context providers
│   ├── FrakConfigProvider.ts
│   └── FrakIFrameClientProvider.ts
└── index.ts          # Barrel exports
```

## Where to Look

| Task | Location |
|------|----------|
| Add new hook | `src/hook/` |
| Provider setup | `src/provider/` |
| Hook tests | `tests/` |

## Build Output

```bash
bun run build         # Build NPM package
bun run build:watch   # Watch mode
```

| Format | Output |
|--------|--------|
| ESM | `dist/index.mjs` |
| CJS | `dist/index.cjs` |
| Types | `dist/index.d.ts` |

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

- **TanStack Query**: All data hooks use React Query
- **Peer deps**: React 18+, React Query required
- **Composition**: Hooks compose from core-sdk actions

## Anti-Patterns

- Direct core-sdk client creation (use `useFrakClient`)
- Skipping provider setup
- Class components

## Testing

- Vitest with jsdom (`react-sdk-unit` project)
- Mock TanStack Query with `@frak-labs/test-foundation`
- Use `renderHook` for hook tests

## Notes

- Requires `FrakConfigProvider` at app root
- Depends on `@frak-labs/core-sdk`
- No CDN build (NPM only)
