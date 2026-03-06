# sdk/core

Framework-agnostic core SDK. 111 total exports.

## Structure

```
src/
├── actions/          # 14 files (displayModal, sendInteraction, displayEmbeddedWallet, etc.)
├── clients/          # FrakClient + iframe communication
├── constants/        # Chain configs, addresses
├── types/            # TypeScript definitions
└── utils/            # 20 files (compression, URL builders, etc.)
```

## Build & Exports

Dual tsdown config for NPM and CDN.

| Format | Output | Usage |
|--------|--------|-------|
| NPM | `dist/` | ESM/CJS (index, actions, bundle entry points) |
| CDN | `cdn/bundle.js` | IIFE with `window.FrakSDK` global |

**Subpath Exports:** `.`, `./actions`, `./bundle`
**Browser Field:** `./cdn/bundle.js`

**Defined Variables:**
- `OPEN_PANEL_API_URL`
- `SDK_VERSION`

## Conventions

- **Pure functions**: No side effects in actions.
- **Type-first**: All exports fully typed.
- **Tree-shakeable**: Named exports only.
- **No React**: Keep framework-agnostic.

## Usage

```typescript
import { FrakClient } from "@frak-labs/core-sdk";
import { sendInteraction } from "@frak-labs/core-sdk/actions";
```

## Testing

- Vitest with jsdom (`core-sdk-unit` project).
- Mock iframe communication.

