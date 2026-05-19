import { globalStyle, style } from "@vanilla-extract/css";

export const tableActions = style({
    display: "flex",
    gap: "8px",
    alignItems: "center",
});

globalStyle(`${tableActions} button`, {
    all: "unset",
    cursor: "pointer",
    display: "flex",
});
