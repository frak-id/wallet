import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

const SIDEBAR_WIDTH_DESKTOP = "240px";
const SIDEBAR_WIDTH_MOBILE = "64px";

// Reserves room under the table so the last row isn't hidden behind the
// fixed footer. Pair with <CampaignsListFooter /> on the same page.
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

// Scroll edge effect — fades the table content out behind the button so
// rows scrolling under the bar don't read as cut off.
export const scrollEdge = style({
    position: "absolute",
    inset: 0,
    backgroundImage: `linear-gradient(to top, ${vars.surface.background2} 30%, rgba(249, 250, 251, 0))`,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    maskImage: "linear-gradient(to top, black 30%, transparent)",
    WebkitMaskImage: "linear-gradient(to top, black 30%, transparent)",
});

export const buttonWrapper = style({
    position: "relative",
    pointerEvents: "auto",
});
