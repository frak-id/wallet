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
 * Container variant for a host that presents this page inside its own sheet.
 *
 * The sharing sheet navigates its one web view here when the install CTA is
 * pressed, so this page has to round the sheet's top corners exactly as
 * `/sharing` does — otherwise the corners square off halfway through the flow.
 * Same custom property, injected once per web view rather than passed per
 * route, so the two cannot drift. Unset on the web, where it resolves to square.
 *
 * `container`'s `overflowY: "auto"` is what makes the radius clip: per the CSS
 * overflow spec an axis left at its `visible` default resolves to `auto` once
 * the other axis is non-visible.
 */
export const containerChromeless = style({
    borderRadius: hostSheetTopRadius,
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    backgroundColor: vars.surface.background,
    position: "sticky",
    top: 0,
    zIndex: zIndex.sticky,
});

export const dismissButton = style({
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    color: vars.text.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

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
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
});

export const heroSection = style({
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const title = style({
    whiteSpace: "pre-line",
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
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
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
