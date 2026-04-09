import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const emptyLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: alias.spacing.m,
});

export const merchantLogoWrapper = style({
    position: "relative",
    marginTop: 2,
    marginRight: 5,
    flexShrink: 0,
    height: "fit-content",
});

export const statusText = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const itemInfo = style({
    minWidth: 0,
});

export const badge = style({
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: alias.cornerRadius.full,
    padding: 2,
    background: vars.surface.background,
});

const badgeInnerBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: alias.cornerRadius.full,
});

export const badgeInner = styleVariants({
    pending: [badgeInnerBase, { background: vars.icon.warning }],
    settled: [badgeInnerBase, { background: vars.icon.secondary }],
});

export const itemButton = style({
    appearance: "none",
    border: "none",
    background: "transparent",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    selectors: {
        "&:active": {
            background: vars.surface.disabled,
        },
    },
});
