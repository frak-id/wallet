import { style } from "@vanilla-extract/css";

export const column = style({
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginBottom: "14px",
    width: "fit-content",
});

export const columnFullWidth = style({
    width: "100%",
});
