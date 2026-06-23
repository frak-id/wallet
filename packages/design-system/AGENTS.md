# packages/design-system — Compass

Vanilla Extract design system. Sprinkles-based responsive; `[data-theme='dark']` switching.

## Key Files
- `src/tokens.css.ts` — brand colors, scale, typography, semantic light/dark tokens
- `src/theme.css.ts` — `createThemeContract` + `createGlobalTheme`; exports `vars`
- `src/sprinkles.css.ts` — responsive conditions (mobile/tablet/desktop) + color-mode
- `src/breakpoints.ts` · `src/reset.css.ts` · `src/reset-globals.css.ts` · `src/defaults.css.ts`
- `src/components/Box/` — polymorphic layout primitive (sprinkles-powered)
- `src/components/` — components grouped by role (+ vendored `charts/`):
  - Layout: Box, Stack, Inline, Column, Columns
  - Typography/feedback: Text, Badge, Spinner, Skeleton, ProgressBar, AlertMessage, StatusBanner, FieldError, EmptyState
  - Inputs: Button, Input, TextArea, Select, Checkbox, RadioGroup, Switch, Slider, TimeInput
  - Overlays: Dialog, Drawer, Sheet, DetailSheet, ResponsiveModal, Popover, Tooltip, ConfirmationTooltip, Accordion, AlertDialog, Overlay, ToastSurface
  - Surfaces/data: Card, Table, Avatar, StatCard, DeltaIndicator, IconCircle, NumberedCircle, Stepper, Tabs, LegendItem
  - Glass/mobile: GlassButton, GlassCloseButton, InAppBanner, BannerStack, PullToRefresh
  - Charts: `charts/` (vendored visx) + FunnelChart

## Usage
```ts
import { Box } from "@frak-labs/design-system/components/Box";
import { vars } from "@frak-labs/design-system/theme";
import { brand, alias } from "@frak-labs/design-system/tokens";

<Box as="section" display="flex" gap="md" padding={{ mobile: "sm", desktop: "lg" }} background="surfacePrimary" />
```

## Non-Obvious Patterns
- **Subpath exports are strict** — no wildcards. Public API is per-component: `@frak-labs/design-system/components/<Name>`.
- **Named exports only** — no default exports. _Exception:_ `src/components/charts/**` is vendored from bklit (visx) and kept close to upstream, so those files may carry `export default` alongside named exports. The public surface (`charts/index.ts` + the `AreaChart`/`BarChart`/`DonutChart` re-export wrappers) stays named-only.
- **Semantic tokens, not raw colors**: `vars.text.*`, `vars.surface.*`, `vars.border.*`, `vars.icon.*`. Brand/scale tokens are for defining aliases, not for direct component use.
- **Sprinkles do NOT accept raw CSS**: only values from the token contract. Unknown values fail at compile time.
- **Theme switch** lives on `[data-theme='dark']` selector; `html` element owns the attribute.
- **Radix primitives** back Dialog/Accordion/Checkbox/Select/Switch/Tooltip. `lucide-react` for icons. `vaul` for Drawer.
- **Tests co-located** (`*.test.tsx`), jsdom, run via design-system-unit project.

## Anti-Patterns
Default exports · wildcard re-exports · raw hex in components · bypassing `Box` with manual layout CSS · importing brand tokens directly in components.

## See Also
Parent `packages/AGENTS.md` · `apps/wallet/AGENTS.md` (primary consumer, migration in progress) · `sdk/components/AGENTS.md` (Web Components consumer).
