import { tablet } from "@frak-labs/design-system/breakpoints";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";
const safeBottom =
    "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))";

export const main = style({
    marginTop: safeTop,
    marginBottom: safeBottom,
    height: `calc(100dvh - 94px - ${safeTop} - ${safeBottom})`,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    selectors: {
        ':root[data-page="sso"] &': {
            marginBottom: 0,
        },
    },
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            margin: 0,
            height: "710px",
        },
    },
});

export const mainNoHeader = style({
    marginTop: 0,
});

export const mainNoNav = style({
    marginBottom: 0,
    height: `calc(100dvh - ${safeTop})`,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            height: "759px",
        },
    },
});

/**
 * Compound override: no header AND no nav.
 * Separate style avoids specificity conflicts between
 * compound selectors (0,2,0) and @media rules (0,1,0).
 */
export const mainNoHeaderNoNav = style({
    height: "100dvh",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            height: "759px",
        },
    },
});
