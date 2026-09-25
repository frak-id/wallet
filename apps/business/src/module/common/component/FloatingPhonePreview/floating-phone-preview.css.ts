import { style } from "@vanilla-extract/css";

/** Window size from which the phone fits beside the form. */
export const phoneVisibleQuery = "(min-width: 1264px) and (min-height: 820px)";

/** The complement: windows too small to fit the phone beside the form. */
export const phoneHiddenQuery = "(max-width: 1263px), (max-height: 819px)";

/**
 * Fixed, vertically centered against the viewport — always visible while
 * scrolling, never tied to a parent's bottom. For pages that can't host a
 * side column (the merchant edit shell).
 */
export const fixed = style({
    "@media": {
        [phoneVisibleQuery]: {
            position: "fixed",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 11,
        },
        [phoneHiddenQuery]: { display: "none" },
    },
});

/**
 * Sticky flex-child: follows the scroll, then stops at the bottom of its row
 * (the form column). Must be rendered as a flex item beside the form.
 */
export const sticky = style({
    flexShrink: 0,
    alignSelf: "flex-start",
    position: "sticky",
    top: "40px",
    zIndex: 1,
    "@media": {
        [phoneHiddenQuery]: { display: "none" },
    },
});
