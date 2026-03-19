# packages/design-system

**Generated:** 2026-03-19
**Commit:** 50035fdd0
**Branch:** feat/vanilla-extract

Vanilla Extract design system replacing `packages/ui`. 28 components, semantic tokens, sprinkles-based responsive styling.

## Structure

```
src/
├── tokens.css.ts       # Brand colors, scale, typography, semantic light/dark tokens
├── theme.css.ts        # createThemeContract + createGlobalTheme (light/dark)
├── sprinkles.css.ts    # Responsive (mobile/tablet/desktop) + color mode conditions
├── reset.css.ts        # CSS reset styles
├── defaults.css.ts     # Default element styles
├── breakpoints.ts      # Breakpoint constants (mobile/tablet/desktop)
├── global.ts           # Global style utilities
└── components/         # 28 components
    ├── Box/            # Core layout primitive (polymorphic, sprinkles-powered)
    ├── Text/ Button/ Card/ Input/ TextArea/ Select/  # Basics
    ├── Dialog/ Drawer/ Accordion/ AlertDialog/ Tooltip/ Overlay/  # Overlays
    ├── Stack/ Inline/ Column/ Columns/  # Layout
    ├── Badge/ Checkbox/ Switch/ Slider/ Spinner/ Skeleton/  # Controls
    └── BottomTabBar/ EmptyState/ SectionHeader/ StatCard/  # Patterns
```

## Tokens & Theming

- **Semantic tokens**: `vars.text.*`, `vars.surface.*`, `vars.border.*`, `vars.icon.*`
- **Theme switching**: `[data-theme='dark']` selector, light = default
- **Token layers**: brand colors → scale → aliases → semantic (light/dark)
- **Access**: `import { vars } from "@frak-labs/design-system/theme.css"`

## Box Component

Core polymorphic layout primitive. Splits sprinkles props from native HTML props.

```typescript
import { Box } from "@frak-labs/design-system/components/Box";

<Box as="section" display="flex" gap="md" padding="lg" background="surfacePrimary">
  <Box as="h2" fontSize="heading2" color="textPrimary">Title</Box>
</Box>
```

## Sprinkles

Responsive properties via conditions:

```typescript
<Box
  display="flex"
  flexDirection={{ mobile: "column", desktop: "row" }}
  padding={{ mobile: "sm", tablet: "md", desktop: "lg" }}
/>
```

## Styling Pattern

Component styles in `{name}.css.ts` using `style()` and `styleVariants()`:

```typescript
// Button.css.ts
import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const base = style({ borderRadius: vars.radius.md });
export const variants = styleVariants({ primary: { ... }, secondary: { ... } });
```

## Imports

Per-component subpath exports:

```typescript
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme.css";
import { sprinkles } from "@frak-labs/design-system/sprinkles.css";
```

## Dependencies

- `@vanilla-extract/css` + `@vanilla-extract/sprinkles` — styling engine
- `@radix-ui/*` — accessible primitives (Dialog, Accordion, Checkbox, Select, Switch, Tooltip)
- `lucide-react` — icons
- `vaul` — drawer component

## Commands

```bash
bun run typecheck    # Uses tsgo --noEmit
bun run test         # Vitest with jsdom
```

## Notes

- Replaces `packages/ui` (migration in progress — wallet app transitioning)
- Tests co-located as `*.test.tsx`
- Wallet tsconfig aliases `@/*` to both `./app/*` and design-system `src/*`
- NO default exports — named exports only
