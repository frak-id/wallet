# sdk/react

React hooks and providers for Frak SDK. Published as `@frak-labs/react-sdk`.

## Structure

```
src/
├── hook/             # React hooks (21 files)
│   ├── useFrakClient.ts
│   ├── useWalletStatus.ts
│   ├── useSendInteraction.ts
│   └── ...
├── provider/         # Context providers
│   ├── FrakConfigProvider.tsx
│   └── FrakWalletProvider.tsx
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

## Hooks (9 public)

| Hook | Purpose |
|------|---------|
| `useFrakClient` | Access FrakClient instance |
| `useWalletStatus` | Wallet connection state |
| `useSendInteraction` | Send interactions to blockchain |
| `useReferralInteraction` | Track referrals |
| `useDisplayModal` | Show SDK modals |
| `useSiweAuthenticate` | SIWE authentication |
| `useOpenSso` | SSO flow |
| `useWatchWalletStatus` | Reactive wallet status |
| `useFrakContext` | Full context access |

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
