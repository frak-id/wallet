import { globalStyle, style } from "@vanilla-extract/css";

export const registerGrid = style({});

globalStyle(`${registerGrid} > div:first-child`, {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 36,
});
