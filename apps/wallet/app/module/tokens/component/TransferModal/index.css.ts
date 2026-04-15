import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Button reset + hover/pressed states for option rows.
 * Layout is handled by Box sprinkles in the component.
 */
export const optionRow = style({
    border: "none",
    background: "transparent",
    width: "100%",
    selectors: {
        "&:hover": {
            backgroundColor: vars.surface.secondaryHover,
        },
        "&:active": {
            backgroundColor: vars.surface.secondaryPressed,
        },
    },
});

/**
 * 40×40 icon circle for option rows (no built-in IconCircle size for 40px).
 * Uses surface-secondary bg + icon-action color per design spec.
 */
export const rowIconCircle = style({
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.action,
    flexShrink: 0,
});

/**
 * Override IconCircle's default icon.tertiary → icon.action.
 */
export const actionIconColor = style({
    color: vars.icon.action,
});
