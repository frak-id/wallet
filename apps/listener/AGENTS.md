# apps/listener

Iframe RPC handler for SDK-to-wallet communication. Embedded in partner sites via SDK.

## Structure

```
app/
├── module/
│   ├── common/       # Shared utilities
│   ├── embedded/     # Embedded wallet UI components
│   ├── hooks/        # RPC message handlers (12 handlers - core logic)
│   ├── modal/        # Modal UI for wallet operations
│   ├── providers/    # RootProvider (Wagmi, QueryClient)
│   └── stores/       # Zustand stores (modal, context state)
├── styles/           # Minimal CSS
└── views/            # Main listener orchestration (RPC setup)
```

## Where to Look

| Task | Location |
|------|----------|
| RPC handlers | `app/module/hooks/` (12 handlers) |
| Modal rendering | `app/module/modal/` |
| Embedded wallet | `app/module/embedded/` |
| Main listener | `app/views/listener.tsx` |
| Entry point | `app/entry.client.tsx` |

## Commands

```bash
bun run dev          # Development server
bun run build        # Production build
bun run test         # Unit tests (listener-unit project)
```

## Conventions

- **RPC pattern**: Each message type has handler in `hooks/`
- **Minimal bundle**: Critical for iframe load time
- **No routing**: Single-page app, no navigation

## Anti-Patterns

- Heavy dependencies (bundle size critical)
- Complex state (keep minimal)
- Direct window.parent access (use postMessage abstraction)

## Testing

- Mock iframe communication via `@frak-labs/test-foundation`
- Test RPC handlers in isolation
- Coverage in `coverage/app/module/hooks/`

## Notes

- Communicates with SDK via `@frak-labs/frame-connector` protocol
- Renders modals for wallet operations (auth, transactions)
- Shares code with wallet via `@frak-labs/wallet-shared`
