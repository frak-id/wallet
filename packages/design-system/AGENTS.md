# packages/design-system — Compass

Vanilla Extract design system. Sprinkles-based responsive; light theme only — `semanticDark` is defined and tested, but no theme block is emitted.

## Key Files

- `src/tokens.css.ts` — brand colors, scale, typography, semantic light/dark tokens
- `src/theme.css.ts` — `createThemeContract` + `createGlobalTheme`; exports `vars`
- `src/sprinkles.css.ts` — responsive conditions (mobile/tablet/desktop) + color-mode
- `src/breakpoints.ts` · `src/reset.css.ts` · `src/reset-globals.css.ts` · `src/defaults.css.ts`
- `src/components/Box/` — polymorphic layout primitive (sprinkles-powered)
- `src/components/` — one directory per component; `charts/` is vendored visx (bklit), `FunnelChart` is ours

## Usage

```ts
import { Box } from "@frak-labs/design-system/components/Box";
import { vars } from "@frak-labs/design-system/theme";
import { brand, alias } from "@frak-labs/design-system/tokens";

<Box as="section" display="flex" gap="md" padding={{ mobile: "sm", desktop: "lg" }} background="surfacePrimary" />
```

## Non-Obvious Patterns

- **Subpath exports are strict** — no wildcards. Public API is per-component: `@frak-labs/design-system/components/<Name>`.
- **Named exports only** — no default exports anywhere in `src/`, vendored `charts/**` included.
- **Semantic tokens, not raw colors**: `vars.text.*`, `vars.surface.*`, `vars.border.*`, `vars.icon.*`. Brand/scale tokens are for defining aliases, not for direct component use.
- **Sprinkles do NOT accept raw CSS**: only values from the token contract. Unknown values fail at compile time.
- **No dark theme ships**: `theme.css.ts` emits `:root` only. `semanticDark` and the `darkMode` sprinkles condition are inert until a switch exists.
- **Radix primitives** back Dialog/Accordion/Checkbox/Select/Switch/Tooltip. `lucide-react` for icons. `vaul` for Drawer.
- **Tests co-located** (`*.test.tsx`), jsdom, run via design-system-unit project.
- **Variant styling — `recipe()` is the default.** Use `recipe()` (from `@vanilla-extract/recipes`) for any component with variants, single- or multi-axis — it owns `base` + variants + `defaultVariants`/`compoundVariants`, and multi-axis components collapse to one `component({ size, tone })` call instead of hand-joining parallel maps. Use `styleVariants()` **only** for an enumerated/iterated key→class map that is looped over rather than selected by a component prop (e.g. `Spinner` `leafRotations`). Use plain `style()` for one-offs with no variants.

## Anti-Patterns

Default exports · wildcard re-exports · raw hex in components · bypassing `Box` with manual layout CSS · importing brand tokens directly in components.

## See Also

Parent `packages/AGENTS.md` · `apps/wallet/AGENTS.md` (primary consumer) · `sdk/components/AGENTS.md` (Web Components consumer).
