# sdk/components — Compass

Preact-based Web Components (Custom Elements). Hybrid Light DOM / Shadow DOM. CDN-first (ESM split with hashed chunks) + NPM per-component entries.

## Component Matrix
| Element | DOM | Reason |
|---------|-----|--------|
| `<frak-button-wallet>` | **Shadow DOM** | Floating overlay must NOT inherit merchant styles. Tag name does not match the surface: it opens the sharing page |
| `<frak-button-share>` | Light DOM | MUST inherit merchant theme `.button` styles |
| `<frak-open-in-app>` | Light DOM | MUST inherit merchant theme styles (mobile-only renderer) |
| `<frak-post-purchase>` | Light DOM | MUST inherit merchant theme styles; see the `token` note below |
| `<frak-banner>` | Light DOM | MUST inherit merchant theme styles |

## Key Files
- `src/components/{ButtonWallet,ButtonShare,OpenInAppButton,PostPurchase,Banner}/`
- `src/hooks/useLightDomStyles.ts` — injects base + placement CSS into `<head>`
- `src/styles/sharedBaseCss.css.ts` — the one entry allowed to emit reset/theme CSS
- `src/styles/sharedCss.ts` — `sharedCss` (Shadow DOM), `lightDomBaseCss` (Light DOM), `buildStyleContent()`
- `src/styles/styleManager.ts` — singleton `<head>` injection with dedup
- `src/webcomponent/registerWebComponent.ts` — custom-element registration helper
- CDN entry points: `src/bootstrap/{loader,initFrakSdk,clientReady}.ts` · shim: `src/components.ts`

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
- **The shim imports its own exact version** (`process.env.SDK_VERSION`, this package's `package.json` version, injected in `tsdown.config.ts`) from jsDelivr, not `@latest`: a browser-cached shim must always resolve a `loader.js` and chunk set that shipped together.
- **`<frak-post-purchase token>` is load-bearing twice**: it feeds `trackPurchaseStatus` AND rides `displaySharingPage` as `checkoutToken`, which is how a buyer with no `frak-client-id` still gets an install link. Dropping it from a plugin's render path silently costs attribution on exactly the ad-blocked buyer the fallback exists for.

## Usage
Merchant defaults still load the jsDelivr `@latest` shim; `https://sdk[-dev].frak.id/components.js` is the first-party pointer they move to next (`docs/plans/sdk-cdn-pointer.md`).
```html
<script src="https://sdk.frak.id/components.js" defer></script>
<frak-button-wallet></frak-button-wallet>
<frak-button-share classname="button"></frak-button-share>
```

## See Also
Parent `sdk/AGENTS.md` · `sdk/core/AGENTS.md` · `packages/design-system/AGENTS.md` (Vanilla Extract plugin shared) · `services/backend/` (placement CSS compilation).
