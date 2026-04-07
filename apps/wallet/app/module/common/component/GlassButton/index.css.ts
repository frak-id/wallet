import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/**
 * Liquid Glass circle — iOS 26 style, powered by @tinymomentum/liquid-glass-react.
 *
 * The inner LiquidGlassBase renders a div.liquid-glass-container (width/height: 100%)
 * that fills this wrapper. Our wrapper controls the final 44×44 dimensions.
 */
export const glassCircle = style({
    position: "relative",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: 0,
    color: "inherit",
});

export const glassCircleDisabled = style({
    color: vars.text.disabled,
    cursor: "not-allowed",
    pointerEvents: "none",
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});
