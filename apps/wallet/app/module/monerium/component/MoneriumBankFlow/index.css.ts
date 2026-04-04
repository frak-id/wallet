import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Circular close button (top-left of each monerium screen).
 */
export const closeButton = style({
    width: "36px",
    height: "36px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: vars.icon.secondary,
    padding: 0,
});

/**
 * 40×40 icon circle for feature rows.
 */
export const featureIcon = style({
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    flexShrink: 0,
});
