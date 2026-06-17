import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const SIDEBAR_WIDTH_DESKTOP = "240px";
const SIDEBAR_WIDTH_MOBILE = "64px";

// Reserves room under the page content so the last row isn't hidden behind
// the fixed footer. Pair with <FloatingFooter /> on the same page.
export const pageBottomSpacer = style({
    paddingBottom: "96px",
});

export const footer = style({
    position: "fixed",
    bottom: 0,
    left: SIDEBAR_WIDTH_DESKTOP,
    right: 0,
    height: "96px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 10,
    "@media": {
        "screen and (max-width: 768px)": {
            left: SIDEBAR_WIDTH_MOBILE,
        },
    },
});

// Scroll edge effect — fades the page content out behind the button so
// rows scrolling under the bar don't read as cut off.
export const scrollEdge = style({
    position: "absolute",
    inset: 0,
    backgroundImage: `linear-gradient(to top, ${vars.surface.background2} 30%, rgba(249, 250, 251, 0))`,
    backdropFilter: "blur(30px)",
    WebkitBackdropFilter: "blur(30px)",
    maskImage: "linear-gradient(to top, black 30%, transparent)",
    WebkitMaskImage: "linear-gradient(to top, black 30%, transparent)",
});

export const footerBare = style({
    left: 0,
    "@media": {
        "screen and (max-width: 768px)": {
            left: 0,
        },
    },
});

export const buttonWrapper = style({
    position: "relative",
    pointerEvents: "auto",
});

// `align="content"`: stretch the bar, inset it to the gutter, then cap the
// inner column at the form width so the button lines up over the content
// column instead of the viewport centre.
export const contentWrapper = style({
    position: "relative",
    width: "100%",
    pointerEvents: "auto",
    paddingLeft: "126px",
    paddingRight: alias.spacing.l,
    "@media": {
        "screen and (max-width: 1024px)": {
            paddingLeft: alias.spacing.l,
        },
        "screen and (max-width: 768px)": {
            paddingLeft: alias.spacing.s,
            paddingRight: alias.spacing.s,
        },
    },
});

export const contentColumn = style({
    maxWidth: "720px",
    display: "flex",
    justifyContent: "center",
});
