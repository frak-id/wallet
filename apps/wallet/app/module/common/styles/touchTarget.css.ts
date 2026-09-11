import { vars } from "@frak-labs/design-system/theme";
import type { ComplexStyleRule } from "@vanilla-extract/css";
import { style } from "@vanilla-extract/css";

/** WCAG 2.2 target size (minimum). */
const TOUCH_TARGET = 44;

/**
 * Expands a control's tappable region to 44px without touching its layout box,
 * so an icon-sized button stays icon-sized and flush against its container edge.
 *
 * Centred on the control. Where an ancestor clips (`overflow: hidden`), the
 * overhang is cut off silently — anchor the region instead, as the welcome-card
 * dismiss does.
 */
export const touchTarget: ComplexStyleRule = {
    selectors: {
        "&::after": {
            content: "",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
        },
    },
};

/** The trailing clear control in a text field: a 24px icon on a 44px region. */
export const clearButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.icon.primary,
    position: "relative",
    ...touchTarget,
});
