# packages/ui — Compass (LEGACY)

Radix + CSS Modules component library. 22 components, 95 files. **Being replaced by `packages/design-system` — do not add new components.** Consumers: business, shopify (wallet is migrating away).

## Key Files
- `component/{Button,Dialog,AlertDialog,Input,Popover,...}/` — one dir per component
  - `index.ts` (exports) · `<Name>.tsx` · `<Name>.module.css`
- `hook/` — 6 shared hooks · `icons/` — 12 SVG React components
- `styles/` — global styles, CSS variables · `utils/` — 22 helper files

## Non-Obvious Patterns
- **Radix-first**: every component wraps a Radix primitive — do not reimplement accessibility.
- **Compound components** use dot notation (`Dialog.Content`, `Dialog.Trigger`).
- **CSS Modules only** — no Tailwind, no inline styles, no vanilla-extract here (that lives in `design-system`).
- **Known duplication**: `AlertDialog` also exists in `packages/wallet-shared` — historical accident.
- **Generic-only**: no app-specific logic; UI primitives must be neutral.
- **Named exports only**.

## Anti-Patterns
Adding new components (use `design-system`) · Tailwind · inline styles · app-specific props · default exports.

## See Also
Parent `packages/AGENTS.md` · `packages/design-system/AGENTS.md` (replacement).
