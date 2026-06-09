import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { loginStackedMedia } from "./breakpoints";

// Phone widths — shrink the oversized display headline. Aligned to the DS
// `tablet` breakpoint (mobile = below tablet).
const mobile = `screen and (max-width: ${tablet - 1}px)`;

export const login = style({
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    background: vars.surface.background2,
    overflow: "hidden",
    "@media": {
        [loginStackedMedia]: {
            height: "auto",
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
            padding: "56px 20px",
        },
    },
});

export const title = style({
    "@media": {
        [mobile]: {
            fontSize: "36px",
            lineHeight: "44px",
        },
    },
});

// Reduce the nested coloured second line on mobile too (DS display1 = 60px).
globalStyle(`${title} *`, {
    "@media": {
        [mobile]: {
            fontSize: "36px",
            lineHeight: "44px",
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
    fontWeight: 400,
    color: vars.text.primary,
    "@media": {
        [mobile]: {
            fontSize: "16px",
            lineHeight: "24px",
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
        [loginStackedMedia]: {
            display: "none",
        },
    },
});

export const screenshotCard = style({
    width: "600px",
    maxWidth: "calc(100% - 48px)",
    background: "#ffffff",
    borderRadius: alias.cornerRadius.l,
    overflow: "hidden",
    boxShadow: "0px 16px 64px 0px rgba(0, 0, 0, 0.08)",
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
        [loginStackedMedia]: {
            position: "static",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: alias.spacing.xs,
            padding: "20px",
        },
    },
});

export const footerLink = style({
    textDecoration: "none",
});

// Legal links sit over the blue panel (white) in the split layout, and on the
// light background (secondary) once the layout collapses.
export const footerLinkText = style({
    color: vars.text.onAction,
    "@media": {
        [loginStackedMedia]: {
            color: vars.text.secondary,
        },
    },
});
