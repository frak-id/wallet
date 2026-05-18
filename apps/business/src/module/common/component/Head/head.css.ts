import { style } from "@vanilla-extract/css";

export const head = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "10px",
});

export const headLeft = style({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
});
