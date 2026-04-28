import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    overflow: "hidden",
});

export const headerLeft = style({
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
});

export const detailLeft = style({
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
});

export const detailRight = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    justifyContent: "flex-end",
    overflow: "hidden",
});

export const deleteButton = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.text.error,
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});

export const laptopIcon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});

export const clockIcon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});
