import { tablet } from "@frak-labs/design-system/breakpoints";
import { safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const main = style({
    marginTop: safeArea.top,
    marginBottom: safeArea.bottom,
    height: `calc(100dvh - 94px - ${safeArea.top} - ${safeArea.bottom})`,
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
    height: `calc(100dvh - ${safeArea.top})`,
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
