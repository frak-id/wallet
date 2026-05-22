import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const triggerBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    minWidth: 0,
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.m,
    background: "transparent",
    color: vars.text.primary,
    fontFamily: "inherit",
    lineHeight: 1.4,
    cursor: "pointer",
    border: "none",
    textDecoration: "none",
} as const;

export const trigger = style({
    ...triggerBase,
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

export const staticTrigger = style({
    ...triggerBase,
    cursor: "default",
});

export const badge = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.secondary,
    color: vars.icon.action,
    fontWeight: brand.typography.fontWeight.semiBold,
    fontSize: "12px",
    flexShrink: 0,
});

export const label = style({
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.medium,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "200px",
});

export const chevron = style({
    color: vars.icon.tertiary,
    flexShrink: 0,
});

export const menu = style({
    // Sits above the fixed header (zIndex 1) and the sidebar nav so the
    // dropdown is not occluded when expanded over surrounding chrome.
    zIndex: zIndex.popover,
    minWidth: "260px",
    padding: alias.spacing.xs,
    background: vars.surface.background,
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.m,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
});

export const section = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    selectors: {
        "&:not(:first-of-type)": {
            marginTop: alias.spacing.s,
            paddingTop: alias.spacing.s,
            borderTop: `1px solid ${vars.border.subtle}`,
        },
    },
});

export const sectionHeading = style({
    padding: `0 ${alias.spacing.s}`,
});

export const list = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

export const item = style({});

export const itemLink = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.s,
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

export const itemLinkActive = style({
    background: vars.surface.muted,
});

export const itemBody = style({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
});

export const itemDomain = style({
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const itemCheck = style({
    color: vars.icon.action,
    flexShrink: 0,
});
