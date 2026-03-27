import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    display: "flex",
    flexDirection: "column",
});

export const row = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    color: "inherit",
    textDecoration: "none",
    selectors: {
        "&:first-of-type": {
            borderTop: "none",
        },
    },
});

export const rowContent = style({
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.s,
});

export const icon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});

export const textGroup = style({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});
