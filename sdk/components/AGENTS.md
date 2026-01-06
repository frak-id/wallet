# sdk/components

Web Components for Frak integration. Preact-based, published as `@frak-labs/components`.

## Structure

```
src/
├── components/
│   ├── ButtonWallet/   # frak-button-wallet Web Component
│   └── ButtonShare/    # frak-button-share Web Component
├── hooks/              # Preact hooks (8 files)
├── utils/              # Shared utilities (14 files)
└── index.ts            # NPM entry
```

## Where to Look

| Task | Location |
|------|----------|
| Modify ButtonWallet | `src/components/ButtonWallet/` |
| Modify ButtonShare | `src/components/ButtonShare/` |
| Internal hooks | `src/hooks/` |
| CSS handling | Build config + utils |

## Build Output

```bash
bun run build         # Build NPM + CDN
bun run build:watch   # Watch mode
```

| Format | Output | Usage |
|--------|--------|-------|
| ESM | `dist/` | NPM imports |
| CDN | `cdn/` | `<script type="module">` |
| CSS | `cdn/loader.css` | Required stylesheet |

## Web Components

```html
<!-- CDN usage -->
<script type="module" src="https://cdn.frak.id/components/loader.js"></script>
<link rel="stylesheet" href="https://cdn.frak.id/components/loader.css">

<frak-button-wallet></frak-button-wallet>
<frak-button-share></frak-button-share>
```

## Conventions

- **Preact**: Lightweight React alternative for bundle size
- **Shadow DOM**: Components use shadow DOM for style isolation
- **CSS Modules**: Lightning CSS with custom plugin for embedding
- **Code splitting**: CDN uses hashed chunks for caching

## Anti-Patterns

- React imports (use Preact)
- Global CSS (use CSS Modules)
- Heavy dependencies (bundle size critical)

## Build Config

Complex tsdown config with:
- Lightning CSS plugin for CSS processing
- Custom CSS combining plugin
- Separate NPM/CDN output directories
- Preact JSX transformation

## Notes

- Depends on `@frak-labs/core-sdk`
- No React Query (pure Preact)
- Custom elements auto-register on import
