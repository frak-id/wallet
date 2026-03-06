# sdk/components

Preact-based Web Components with Shadow DOM.

## Components

- `<frak-button-wallet>`: Wallet modal trigger.
- `<frak-button-share>`: Share/referral button.
- `<frak-open-in-app>`: App store redirect (mobile only).

## Structure

```
src/
├── components/
│   ├── ButtonWallet/
│   ├── ButtonShare/
│   └── OpenInAppButton/
├── hooks/              # Preact hooks
├── utils/              # Shared utilities
└── index.ts            # NPM entry
```

## Build & Output

Uses Lightning CSS + custom plugins for embedding and combining CSS.

| Format | Output | Usage |
|--------|--------|-------|
| NPM | `dist/` | Separate entry points per component |
| CDN | `cdn/` | ESM with code splitting (hashed chunks) |

**CDN Entry Points:** `components.ts`, `loader.ts`
**CSS:** `combineCssPlugin` merges CSS into `loader.css`.

## Usage

```html
<script type="module" src="https://cdn.frak.id/components/loader.js"></script>
<link rel="stylesheet" href="https://cdn.frak.id/components/loader.css">

<frak-button-wallet></frak-button-wallet>
```

## Conventions

- **Preact**: Lightweight React alternative.
- **Shadow DOM**: Style isolation.
- **CSS Modules**: Lightning CSS with custom embedding plugin.
- **Code Splitting**: CDN uses hashed chunks for caching.

## Notes

- Depends on `@frak-labs/core-sdk`.
- Custom elements auto-register on import.

