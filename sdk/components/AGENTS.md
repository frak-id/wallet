# sdk/components — Compass

Preact-based Web Components (Custom Elements). Hybrid Light DOM / Shadow DOM. CDN-first (ESM split with hashed chunks) + NPM per-component entries.

## Component Matrix
| Element | DOM | Reason |
|---------|-----|--------|
| `<frak-button-wallet>` | **Shadow DOM** | Floating overlay must NOT inherit merchant styles |
| `<frak-button-share>` | Light DOM | MUST inherit merchant theme `.button` styles |
| `<frak-open-in-app>` | Light DOM | MUST inherit merchant theme styles (mobile-only renderer) |

## Key Files
- `src/components/{ButtonWallet,ButtonShare,OpenInAppButton}/`
- `src/hooks/useLightDomStyles.ts` — injects base + placement CSS into `<head>`
- `src/utils/sharedCss.ts` — `sharedCss` (Shadow DOM) + `lightDomBaseCss` (Light DOM)
- `src/utils/styleManager.ts` — singleton `<head>` injection with dedup
- `src/utils/registerWebComponent.ts` — custom-element registration helper (scoping happens inside via shared helpers)
- CDN entry points: `src/utils/loader.ts`, `src/utils/initFrakSdk.ts`, `src/utils/clientReady.ts`

## Non-Obvious Patterns
- **Specificity ladder (Light DOM)** — order matters:
  - base `:where()` selectors → **0,0,0** (never overrides theme)
  - merchant theme `.button` → **0,1,0**
  - placement CSS `frak-x[placement="hero"] .button` → **0,2,2** (overrides theme)
- **FOUCE prevention**: `frak-*:not(:defined) { display: none !important }` injected at loader init. Merchants loading via `defer`/`async` must add this snippet manually early in `<head>`.
- **Shadow DOM uses `:host { display: contents }`** for layout transparency; inline `<style>` inside shadow root via `buildStyleContent()`.
- **Keyframes are prefixed `frak-`** (e.g., `frak-fadeIn`) to avoid light-DOM collisions.
- **Placement CSS pipeline**: pre-scoped on the backend via LightningCSS (sanitization + scoping + minification) before being injected — don't replicate that pipeline client-side.
- **Custom elements auto-register on import** — `components.ts` import has side effects.
- **CDN uses hashed chunks** — cache-bust is automatic; don't pin chunk names.

## Usage
```html
<script type="module" src="https://cdn.frak.id/components/loader.js"></script>
<frak-button-wallet></frak-button-wallet>
<frak-button-share classname="button"></frak-button-share>
```

## See Also
Parent `sdk/AGENTS.md` · `sdk/core/AGENTS.md` · `packages/design-system/AGENTS.md` (Vanilla Extract plugin shared) · `services/backend/` (placement CSS compilation).
