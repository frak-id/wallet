import { vars } from "@frak-labs/design-system/theme";
import { easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Keyboard-only focus ring. Outset boxShadow so it survives `all: unset`,
 * never shifts layout, and reads cleanly around standalone controls (sits
 * outside the element, so edge-content like avatars stays untouched).
 * Follows the element's own border-radius. For rows inside a scroll/overflow
 * container, use `focusRingInset` instead — an outset ring there gets clipped.
 */
export const focusRing = style({
    selectors: {
        "&:focus-visible": {
            outline: "none",
            boxShadow: `0 0 0 2px ${vars.border.focus}`,
        },
    },
});

/**
 * Inset variant — for elements inside a scroll/overflow container (menu list
 * rows, command items) where an outset ring would be clipped by the container
 * edge or covered by a sibling row.
 */
export const focusRingInset = style({
    selectors: {
        "&:focus-visible": {
            outline: "none",
            boxShadow: `inset 0 0 0 2px ${vars.border.focus}`,
        },
    },
});

/**
 * Standard micro-transition for interactive surfaces (token-based).
 */
export const interactive = style({
    transition: `background-color ${transition.fast} ${easing.default}, color ${transition.fast} ${easing.default}`,
});
