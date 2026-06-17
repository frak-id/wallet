import { style } from "@vanilla-extract/css";

/** Hidden when the window is too small to fit the phone beside the form. */
const hideWhenTight = {
    "(max-width: 1263px), (max-height: 819px)": { display: "none" },
} as const;

/**
 * Fixed, vertically centered against the viewport — always visible while
 * scrolling, never tied to a parent's bottom. For pages that can't host a
 * side column (the merchant edit shell).
 */
export const fixed = style({
    "@media": {
        "(min-width: 1264px) and (min-height: 820px)": {
            position: "fixed",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 11,
        },
        ...hideWhenTight,
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
        "(max-width: 1263px), (max-height: 819px)": { display: "none" },
    },
});
