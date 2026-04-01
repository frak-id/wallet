# sdk/components

Preact-based Web Components with hybrid light DOM / Shadow DOM architecture.

## Components

| Component | DOM Mode | Reason |
|-----------|----------|--------|
| `<frak-button-wallet>` | Shadow DOM | Isolated floating overlay, must not inherit merchant styles |
| `<frak-button-share>` | Light DOM | Must inherit merchant theme styles (Shopify `.button` class) |
| `<frak-open-in-app>` | Light DOM | Must inherit merchant theme styles |

## Structure

```
src/
├── components/
│   ├── ButtonWallet/     # Shadow DOM — inline <style> in shadow root
│   ├── ButtonShare/      # Light DOM — styles injected into <head>
│   └── OpenInAppButton/  # Light DOM — styles injected into <head>
├── hooks/
│   ├── useLightDomStyles.ts  # Injects base + placement CSS into <head>
│   └── ...
├── utils/
│   ├── sharedCss.ts      # sharedCss (Shadow DOM) + lightDomBaseCss (Light DOM)
│   ├── styleManager.ts   # Singleton for <head> style injection with dedup
│   ├── scopeCss.ts       # Scopes placement CSS via attribute selectors
│   └── ...
└── index.ts
```

## Build & Output

| Format | Output | Usage |
|--------|--------|-------|
| NPM | `dist/` | Separate entry points per component |
| CDN | `cdn/` | ESM with code splitting (hashed chunks) |

**CDN Entry Points:** `components.ts`, `loader.ts`

## Usage

```html
<script type="module" src="https://cdn.frak.id/components/loader.js"></script>

<frak-button-wallet></frak-button-wallet>
<frak-button-share classname="button"></frak-button-share>
```

## Styling Architecture

### Light DOM (ButtonShare, OpenInAppButton)

Specificity ladder — merchant theme styles always win over base:

| Specificity | Source | Example |
|-------------|--------|---------|
| `0,0,0` | Base styles (`:where()`) | `:where(frak-button-share .button) { display: flex }` |
| `0,1,0` | Merchant theme | `.button { background: var(--theme-color) }` |
| `0,2,2` | Placement CSS | `frak-button-share[placement="hero"] .button { ... }` |

- **Base styles**: Injected into `<head>` via `styleManager.injectBase()`, use `:where()` for zero specificity
- **Placement CSS**: Scoped per-instance via `scopeCss()` using attribute selectors, injected into `<head>`
- **FOUCE prevention**: `frak-*:not(:defined) { display: none !important }` injected at loader init
- **Merchant integration**: `classname="button"` attribute passes theme classes directly to the `<button>`

### Shadow DOM (ButtonWallet)

- Inline `<style>` inside shadow root via `buildStyleContent()`
- `:host { display: contents }` for layout transparency
- Placement CSS rendered as additional `<style>` after base styles
- Fully isolated — no merchant style leakage

## Conventions

- **Preact**: Lightweight React alternative
- **Hybrid DOM**: Light DOM for inheritable buttons, Shadow DOM for overlays
- **Code Splitting**: CDN uses hashed chunks for caching
- **CSS keyframes**: Prefixed `frak-fadeIn` to avoid collisions in light DOM

## FOUCE Prevention

SDK injects `frak-*:not(:defined) { display: none !important }` at loader init. For merchants loading the SDK with `defer` or `async`, add this snippet early in `<head>` to prevent flash of unstyled custom elements:

```html
<style>
  frak-button-share:not(:defined),
  frak-button-wallet:not(:defined),
  frak-open-in-app:not(:defined) { display: none !important; }
</style>
```

## Notes

- Depends on `@frak-labs/core-sdk`
- Custom elements auto-register on import
- Backend processes placement CSS at query time (LightningCSS sanitization + scoping + minification)
- Light DOM component CSS is pre-scoped on the backend via CSS nesting compiled by LightningCSS

