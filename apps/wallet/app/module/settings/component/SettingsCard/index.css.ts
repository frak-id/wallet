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
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    color: "inherit",
    textDecoration: "none",
});

export const rowTop = style({
    alignItems: "flex-start",
});

export const rowContent = style({
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
});

export const rowContentTop = style({
    alignItems: "flex-start",
});

export const icon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});

export const action = style({
    flexShrink: 0,
});

export const actionButton = style({
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    textDecoration: "none",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
        },
    },
});
