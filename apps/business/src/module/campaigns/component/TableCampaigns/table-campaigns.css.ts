import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const budgetRow = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: alias.spacing.xs,
});

export const budgetBarTrack = style({
    height: alias.size.xs,
    marginTop: alias.spacing.xxs,
    backgroundColor: vars.surface.disabled,
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
});

export const budgetBarFill = style({
    height: "100%",
    backgroundColor: vars.surface.primary,
    borderRadius: alias.cornerRadius.full,
    transition: "width 200ms ease",
});

// Empty hook style — used only as a scope selector below so the
// last-column padding override doesn't leak into other tables.
export const campaignsTable = style({});

globalStyle(
    `${campaignsTable} > thead > tr > th:last-child, ${campaignsTable} > tbody > tr > td:last-child`,
    {
        paddingLeft: 0,
        paddingRight: alias.spacing.xs,
    }
);

export const rowMenuCell = style({
    display: "flex",
    justifyContent: "flex-end",
});

export const rowMenuButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: vars.icon.tertiary,
    opacity: 0,
    transition: "opacity 0.15s ease, color 0.15s ease",
    selectors: {
        "tr:hover &, &:focus-visible, &[data-state=open]": {
            opacity: 1,
        },
        "&:hover, &[data-state=open]": {
            color: vars.icon.primary,
        },
    },
});

export const rowMenuList = style({
    display: "flex",
    flexDirection: "column",
    width: 240,
    padding: alias.spacing.xxs,
});

export const rowMenuSection = style({
    display: "flex",
    flexDirection: "column",
});

export const rowMenuDivider = style({
    height: 1,
    margin: `${alias.spacing.xxs} ${alias.spacing.s}`,
    backgroundColor: vars.border.subtle,
});

export const rowMenuItem = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    width: "100%",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: vars.text.primary,
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    lineHeight: "22px",
    textDecoration: "none",
    textAlign: "left",
    borderRadius: alias.cornerRadius.s,
    selectors: {
        "&:hover, &:focus-visible": {
            backgroundColor: vars.surface.secondaryHover,
            outline: "none",
        },
    },
});

export const rowMenuItemDestructive = style({
    color: vars.text.error,
});

globalStyle(`${rowMenuItem} svg`, {
    flexShrink: 0,
    color: vars.icon.action,
});

globalStyle(`${rowMenuItemDestructive} svg`, {
    color: vars.icon.error,
});
