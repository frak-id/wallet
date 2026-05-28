import { globalStyle } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

// Bridges bklit's `--chart-*` CSS variables (referenced verbatim across the
// vendored visx chart files) onto Frak design tokens. Values are themselves
// theme-aware `var(--…)` references, so light/dark switch automatically.
globalStyle(":root", {
    vars: {
        "--chart-background": vars.surface.background,
        "--chart-foreground": vars.text.primary,
        "--chart-foreground-muted": vars.text.tertiary,
        "--chart-label": vars.text.tertiary,
        "--chart-line-primary": vars.icon.action,
        "--chart-line-secondary": vars.icon.tertiary,
        "--chart-crosshair": vars.border.default,
        "--chart-grid": vars.border.subtle,
        "--chart-indicator-color": vars.icon.action,
        "--chart-indicator-secondary-color": vars.icon.tertiary,
        "--chart-marker-background": vars.surface.background,
        "--chart-marker-border": vars.border.default,
        "--chart-marker-foreground": vars.text.primary,
        "--chart-marker-badge-background": vars.icon.action,
        "--chart-marker-badge-foreground": vars.text.onAction,
        "--chart-segment-background": vars.surface.muted,
        "--chart-segment-line": vars.border.default,
        "--chart-tooltip-background": vars.text.primary,
        "--chart-tooltip-foreground": vars.surface.background,
        "--chart-tooltip-muted": vars.icon.tertiary,
        "--chart-1": vars.icon.action,
        "--chart-2": vars.icon.success,
        "--chart-3": vars.icon.warning,
        "--chart-4": vars.icon.tertiary,
        "--chart-5": vars.text.secondary,
    },
});
