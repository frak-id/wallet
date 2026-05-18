import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: "14px",
});

globalStyle(`${container} > :first-child`, {
    overflowX: "auto",
});

export const trigger = style({
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    color: vars.icon.action,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ":hover": {
        color: vars.icon.actionHover,
    },
});
