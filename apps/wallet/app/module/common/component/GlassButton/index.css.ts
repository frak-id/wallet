import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/**
 * Liquid Glass circle — iOS 26 style frosted-glass button.
 * Renders a circular button with a Figma-exported WebP background
 * and a centered icon on top.
 */
export const glassCircle = style({
    position: "relative",
    width: 44,
    height: 44,
    display: "flex",
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
});

export const glassImage = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});
