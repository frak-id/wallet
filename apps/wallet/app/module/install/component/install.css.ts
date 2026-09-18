import { hostSheetTopRadius } from "@frak-labs/design-system/hostSheet";
import { vars } from "@frak-labs/design-system/theme";
import {
    alias,
    fontSize,
    safeArea,
    zIndex,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
});

/**
 * Container variant for a host that presents this page inside its own sheet:
 * rounds the sheet's top corners from a custom property the host injects, unset
 * on the web. `container`'s `overflowY: "auto"` is what makes the radius clip.
 */
export const containerChromeless = style({
    borderRadius: hostSheetTopRadius,
});

export const header = style({
    top: 0,
    zIndex: zIndex.sticky,
});

export const dismissButton = style({
    color: vars.text.primary,
});

// `alias.size` jumps 16px to 36px, so both logo heights stay literals.
export const logo = style({
    height: "24px",
    width: "auto",
});

export const merchantLogo = style({
    height: "24px",
    width: "auto",
    borderRadius: alias.cornerRadius.xs,
    objectFit: "contain",
});

export const main = style({
    flex: 1,
});

export const heroSection = style({
    textAlign: "center",
});

/** The hero's children are centred text; the installed state's icon disc has
 * a fixed width and needs centring on its own. */
export const installedIcon = style({
    alignSelf: "center",
});

export const title = style({
    whiteSpace: "pre-line",
    // The installed headline is a full sentence, unlike the two-line code
    // titles this class was written for: without a wrap it runs off-screen.
    overflowWrap: "anywhere",
});

export const copyButton = style({
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    border: `1.5px solid ${vars.text.primary}`,
    textTransform: "uppercase",
    selectors: {
        "&:not(:disabled):active": {
            backgroundColor: vars.surface.background,
        },
    },
    "@media": {
        "(hover: hover)": {
            selectors: {
                "&:not(:disabled):hover": {
                    backgroundColor: vars.surface.background,
                },
            },
        },
    },
});

export const infoCard = style({
    marginTop: "auto",
    marginInline: alias.spacing.m,
    flexShrink: 0,
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: `${alias.spacing.m}`,
    paddingBottom: `max(${alias.spacing.l}, ${safeArea.bottom})`,
    backgroundColor: vars.surface.background,
});

export const downloadButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontSize: fontSize.s,
    fontWeight: 600,
    lineHeight: "100%",
    textDecoration: "none",
    cursor: "pointer",
    border: "none",
    ":hover": {
        color: vars.text.onAction,
    },
    ":active": {
        color: vars.text.onAction,
    },
    ":visited": {
        color: vars.text.onAction,
    },
});

// `Button` size="none" carries the recipe's semibold; this control is a text
// link, not a button label.
export const installedCodeToggle = style({
    color: vars.text.secondary,
    textDecoration: "underline",
    alignSelf: "center",
    fontWeight: 400,
});
