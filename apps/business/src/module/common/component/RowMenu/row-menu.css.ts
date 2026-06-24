import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/** Kebab trigger — hidden until the row is hovered/focused or the menu is open. */
export const button = style({
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

export const list = style({
    display: "flex",
    flexDirection: "column",
    width: 240,
    padding: alias.spacing.xxs,
});

export const section = style({
    display: "flex",
    flexDirection: "column",
});

export const divider = style({
    height: 1,
    margin: `${alias.spacing.xxs} ${alias.spacing.s}`,
    backgroundColor: vars.border.subtle,
});

export const item = style({
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

export const itemDestructive = style({
    color: vars.text.error,
});

// Descendant (icon) styling must use globalStyle in vanilla-extract — `& svg`
// inside a style's `selectors` is not allowed.
globalStyle(`${item} svg`, {
    flexShrink: 0,
    color: vars.icon.action,
});

globalStyle(`${itemDestructive} svg`, {
    color: vars.icon.error,
});
