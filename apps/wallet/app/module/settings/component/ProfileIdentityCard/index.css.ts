import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    display: "flex",
    flexDirection: "column",
});

export const row = style({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    background: "none",
    border: "none",
    borderRadius: 0,
    cursor: "pointer",
    textAlign: "left",
    selectors: {
        "&:last-child": {
            borderBottom: "none",
            paddingBottom: 0,
        },
    },
});

export const rowContent = style({
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
});

export const value = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: vars.text.primary,
});

export const valueRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const copyIcon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});

export const deviceStatusIcon = style({
    color: vars.icon.success,
    flexShrink: 0,
});
