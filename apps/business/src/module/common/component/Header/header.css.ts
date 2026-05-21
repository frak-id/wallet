import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const header = style({
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "column",
    gap: alias.spacing.xs,
    position: "fixed",
    zIndex: 1,
    width: "100%",
    height: "72px",
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    background: vars.surface.elevated,
    borderBottom: `1px solid ${vars.border.default}`,
});

export const headerLogo = style({
    position: "absolute",
    marginTop: "-18px",
    top: "50%",
    left: "28px",
    color: vars.text.action,
});

export const navigationTopContainer = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.l,
});

export const navigationTopList = style({
    display: "flex",
    gap: "40px",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const navigationTopItemButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    cursor: "pointer",
});

export const navigationProfileSeparator = style({
    width: "1px",
    height: "32px",
    background: vars.border.default,
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const navigationProfile = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: "6px 10px",
    borderRadius: alias.cornerRadius.s,
    color: vars.text.primary,
    textDecoration: "none",
    transition: "background-color 0.15s ease",
    selectors: {
        "&:hover": {
            backgroundColor: vars.surface.muted,
        },
    },
});

export const navigationProfileAvatar = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: alias.cornerRadius.full,
    border: `1px solid ${vars.border.default}`,
    backgroundColor: vars.surface.elevated,
    color: vars.text.secondary,
});

globalStyle(`${navigationProfileAvatar} > svg`, {
    width: "18px",
    height: "18px",
});

export const navigationProfileInfos = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

globalStyle(`${navigationProfileInfos} > span:last-child`, {
    fontSize: "12px",
});

export const demoModeBadge = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    color: "#93c5fd",
    border: "1px solid rgba(147, 197, 253, 0.3)",
    borderRadius: alias.cornerRadius.m,
    fontSize: "11px",
    fontWeight: brand.typography.fontWeight.medium,
    letterSpacing: "0.5px",
    cursor: "pointer",
    textTransform: "lowercase",
});
