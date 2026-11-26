import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/** Class given to the driver.js popover. The rules below beat its own stylesheet. */
export const popover = style({});

export const extras = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
    marginTop: alias.spacing.xs,
});

export const link = style({
    all: "unset",
    cursor: "pointer",
    boxSizing: "border-box",
    fontSize: fontSize.xs,
    color: vars.text.secondary,
    textDecoration: "underline",
    borderRadius: alias.cornerRadius.xs,
    selectors: {
        "&:focus-visible": {
            boxShadow: `0 0 0 2px ${vars.surface.background}, 0 0 0 4px ${vars.border.focus}`,
        },
    },
});

const root = `.driver-popover.${popover}`;

globalStyle(root, {
    fontFamily: "inherit",
    maxWidth: "min(360px, calc(100vw - 32px))",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    boxShadow: "0 4px 16px 0 rgba(115, 115, 115, 0.3)",
});

globalStyle(`${root} .driver-popover-title`, {
    paddingRight: alias.spacing.l,
    fontSize: fontSize.l,
    fontWeight: 600,
    color: vars.text.primary,
});

globalStyle(`${root} .driver-popover-description`, {
    fontSize: fontSize.s,
    color: vars.text.secondary,
});

globalStyle(`${root} .driver-popover-progress-text`, {
    fontSize: fontSize.xs,
    color: vars.text.secondary,
});

globalStyle(`${root} .driver-popover-close-btn`, {
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    color: vars.text.secondary,
    borderRadius: alias.cornerRadius.xs,
});

globalStyle(`${root} .driver-popover-close-btn:hover`, {
    color: vars.text.primary,
});

globalStyle(`${root} .driver-popover-footer-btn`, {
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    border: "none",
    borderRadius: alias.cornerRadius.full,
    fontSize: fontSize.s,
    lineHeight: 1,
    backgroundColor: vars.surface.secondary,
    color: vars.text.primary,
});

globalStyle(`${root} .driver-popover-next-btn`, {
    backgroundColor: vars.surface.primary,
    color: vars.text.onAction,
});

globalStyle(`${root} .driver-popover-next-btn:hover`, {
    backgroundColor: vars.surface.primaryHover,
});

globalStyle(
    `${root} .driver-popover-footer-btn:focus-visible, ${root} .driver-popover-close-btn:focus-visible`,
    {
        outline: "none",
        boxShadow: `0 0 0 2px ${vars.surface.background}, 0 0 0 4px ${vars.border.focus}`,
    }
);

for (const [side, property] of [
    ["top", "borderTopColor"],
    ["right", "borderRightColor"],
    ["bottom", "borderBottomColor"],
    ["left", "borderLeftColor"],
] as const) {
    globalStyle(`${root} .driver-popover-arrow-side-${side}`, {
        [property]: vars.surface.background,
    });
}
