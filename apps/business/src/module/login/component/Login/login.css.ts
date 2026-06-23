import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { loginStackedMedia } from "./breakpoints";

export const login = style({
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    background: vars.surface.background2,
    overflow: "hidden",
    "@media": {
        // Stacked: full-height column so hero + panel split the viewport 50/50.
        [loginStackedMedia]: {
            display: "flex",
            flexDirection: "column",
            minHeight: "100dvh",
            overflow: "visible",
        },
    },
});

export const hero = style({
    position: "absolute",
    left: "120px",
    // Bound the hero by the panel edge (50%) so the text never slides under it.
    right: "calc(50% + 24px)",
    top: "50%",
    transform: "translateY(-50%)",
    maxWidth: "515px",
    "@media": {
        [loginStackedMedia]: {
            position: "static",
            transform: "none",
            right: "auto",
            width: "100%",
            maxWidth: "none",
            flex: "0 0 auto",
            // Half the viewport when content fits; grows on short phones so the
            // subtitle/button never get clipped under the blue panel.
            minHeight: "50dvh",
            // Centre the hero block vertically in its half; text stays
            // left-aligned (align="left").
            justifyContent: "center",
            padding: "48px 24px",
        },
    },
});

// Shrink the heading on stacked layouts. Applied to both the h1 and its nested
// coloured second line (same class on both) so no descendant selector is needed.
export const title = style({
    "@media": {
        [loginStackedMedia]: {
            fontSize: "40px",
            lineHeight: "48px",
        },
    },
});

export const logo = style({
    display: "block",
    width: "105px",
    height: "40px",
});

export const subtitle = style({
    margin: 0,
    fontSize: "18px",
    lineHeight: "28px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.primary,
    "@media": {
        [loginStackedMedia]: {
            fontSize: "16px",
            lineHeight: "26px",
        },
    },
});

export const rightPanel = style({
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    width: "50%",
    background: vars.surface.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "@media": {
        // Mobile: blue panel becomes a band below the hero. Height tracks
        // the (responsive) card via padding instead of a fixed phone-only value,
        // so the card never looks lost on wider tablet-portrait widths.
        [loginStackedMedia]: {
            position: "static",
            width: "100%",
            height: "auto",
            flex: "0 0 auto",
            minHeight: "50dvh",
            padding: "24px",
        },
    },
});

export const screenshotCard = style({
    width: "600px",
    maxWidth: "calc(100% - 48px)",
    background: brand.colors.neutral.white,
    borderRadius: alias.cornerRadius.l,
    overflow: "hidden",
    boxShadow: "0px 16px 64px 0px rgba(0, 0, 0, 0.08)",
    "@media": {
        [loginStackedMedia]: {
            // 297px on a 393px phone, scaling up to 560px on wide
            // tablet-portrait widths so it doesn't look tiny near the split.
            width: "clamp(297px, 60vw, 560px)",
            borderRadius: "9.121px",
            boxShadow: "0px 7.708px 32.758px 0px rgba(0, 0, 0, 0.08)",
        },
    },
});

export const screenshot = style({
    display: "block",
    width: "100%",
    height: "auto",
});

export const footer = style({
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    padding: `0 120px ${alias.spacing.l}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    "@media": {
        // The mobile/tablet-portrait layout has no footer.
        [loginStackedMedia]: {
            display: "none",
        },
    },
});

export const footerLink = style({
    textDecoration: "none",
});

// Legal links sit over the blue panel (white) in the split layout. The footer
// is hidden once the layout collapses, so no stacked override is needed.
export const footerLinkText = style({
    color: vars.text.onAction,
});
