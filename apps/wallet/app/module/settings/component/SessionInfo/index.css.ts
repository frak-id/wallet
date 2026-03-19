import { style } from "@vanilla-extract/css";

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    listStyle: "none",
    padding: 0,
    margin: 0,
});

export const listItem = style({
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
});
