import { style } from "@vanilla-extract/css";

export const actions = style({
    display: "flex",
});

export const actionLeft = style({
    flex: 1,
    display: "flex",
    gap: "15px",
});

export const actionRight = style({
    flex: 1,
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
});
