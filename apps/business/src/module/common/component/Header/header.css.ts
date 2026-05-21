import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const header = style({
    position: "fixed",
    top: 0,
    left: "240px",
    right: 0,
    zIndex: 1,
    height: "70px",
    padding: `0 ${alias.spacing.l}`,
    background: vars.surface.background,
    borderBottom: `1px solid ${vars.border.subtle}`,
    "@media": {
        "screen and (max-width: 768px)": {
            left: "64px",
            padding: `0 ${alias.spacing.s}`,
        },
    },
});

export const headerInner = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
    gap: alias.spacing.m,
});

export const headerLeft = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    minWidth: 0,
    flexShrink: 1,
    overflow: "hidden",
});

export const headerRight = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.l,
    flexShrink: 0,
    "@media": {
        "screen and (max-width: 768px)": {
            gap: alias.spacing.s,
        },
    },
});

export const breadcrumb = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const breadcrumbLink = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.m,
    color: vars.text.tertiary,
    textDecoration: "none",
    transition: "background 0.15s ease, color 0.15s ease",
    "@media": {
        "(hover: hover)": {
            selectors: {
                "&:hover": {
                    background: vars.surface.muted,
                },
            },
        },
    },
});

export const breadcrumbSeparator = style({
    color: vars.text.tertiary,
});

export const breadcrumbCurrent = style({
    color: vars.text.primary,
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
});

export const actionGroup = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 768px)": {
            gap: alias.spacing.xs,
        },
    },
});

export const profileLink = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.m,
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    color: vars.text.primary,
    textDecoration: "none",
    transition: "background 0.15s ease",
    "@media": {
        "(hover: hover)": {
            selectors: {
                "&:hover": {
                    background: vars.surface.muted,
                },
            },
        },
    },
});

export const profileContent = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const profileAvatar = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    color: vars.icon.action,
    flexShrink: 0,
});

globalStyle(`${profileAvatar} > svg`, {
    width: "24px",
    height: "24px",
});

export const profileLabel = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const profileChevron = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
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
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const hideOnMobile = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});
