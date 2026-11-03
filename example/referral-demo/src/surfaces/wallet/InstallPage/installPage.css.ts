import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { fonts } from "@/shell/device.css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: vars.surface.background,
});

export const container = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    fontFamily: fonts.inter,
});

export const header = style({
    position: "sticky",
    top: 0,
    zIndex: 2,
    flexShrink: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    backgroundColor: vars.surface.background,
});

export const logo = style({
    height: 24,
    width: "auto",
});

export const dismissButton = style({
    display: "grid",
    placeItems: "center",
    padding: 0,
    border: 0,
    background: "transparent",
    color: vars.text.primary,
});

export const main = style({
    flex: 1,
});

export const title = style({
    whiteSpace: "pre-line",
    overflowWrap: "anywhere",
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: alias.spacing.m,
    paddingBottom: alias.spacing.l,
    backgroundColor: vars.surface.background,
});

export const downloadButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.full,
    border: "none",
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontFamily: fonts.inter,
    fontSize: fontSize.s,
    fontWeight: 600,
    lineHeight: "100%",
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
    selectors: {
        "&:active": { transform: "scale(0.98)", opacity: 0.85 },
    },
});

export const storeHint = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
});
