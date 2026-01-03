# apps/listener

Iframe RPC handler for SDK-to-wallet communication. Embedded in partner sites via SDK.

## Structure

```
app/
├── module/
│   ├── common/       # Shared utilities
│   ├── hooks/        # RPC message handlers (18 files - core logic)
│   ├── listener/     # Main listener orchestration
│   └── utils/        # Communication utilities
├── styles/           # Minimal CSS
└── views/            # UI components for modals
```

## Where to Look

| Task | Location |
|------|----------|
| RPC handlers | `app/module/hooks/` (18 handlers) |
| Modal rendering | `app/views/` |
| Main listener | `app/module/listener/` |
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
