# sdk/core

Core SDK for Frak ecosystem integration. Framework-agnostic, published as `@frak-labs/core-sdk`.

## Structure

```
src/
├── actions/          # Blockchain interactions (17 files)
│   ├── displayModal.ts
│   ├── sendInteraction.ts
│   ├── siweAuthenticate.ts
│   └── ...
├── clients/          # FrakClient + iframe communication
├── constants/        # Chain configs, addresses
├── interactions/     # Interaction type builders (11 files)
├── types/            # TypeScript definitions
└── utils/            # Helpers (23 files)
```

## Where to Look

| Task | Location |
|------|----------|
| Add blockchain action | `src/actions/` |
| Interaction types | `src/interactions/` |
| Client setup | `src/clients/FrakClient.ts` |
| Type definitions | `src/types/` |
| Utility helpers | `src/utils/` |

## Build Output

```bash
bun run build         # Build NPM + CDN
bun run build:watch   # Watch mode
bun run check-exports # Verify package exports
```

| Format | Output | Usage |
|--------|--------|-------|
| ESM | `dist/index.mjs` | Modern bundlers |
| CJS | `dist/index.cjs` | Node.js require() |
| IIFE | `cdn/bundle.global.js` | Browser `<script>` tag |
| Types | `dist/index.d.ts` | TypeScript |

**CDN Global**: `window.FrakSDK`

## Conventions

- **Pure functions**: No side effects in actions
- **Type-first**: All exports fully typed
- **Tree-shakeable**: Named exports only
- **No React**: Framework-agnostic (see `sdk/react` for hooks)

## Entry Points

```typescript
import { FrakClient } from "@frak-labs/core-sdk";           // Main client
import { sendInteraction } from "@frak-labs/core-sdk/actions";  // Actions
import { PressInteraction } from "@frak-labs/core-sdk/interactions"; // Builders
```

## Anti-Patterns

- React/DOM dependencies (keep framework-agnostic)
- Side effects in module scope
- Default exports

## Testing

- Vitest with jsdom (`core-sdk-unit` project)
- Tests in `tests/` directory
- Mock iframe communication

## Notes

- Build order: `rpc → core → legacy → react → components`
- Changesets for versioning (linked with react-sdk, frame-connector)
- CDN published to `cdn.frak.id`
