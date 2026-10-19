import { style } from "@vanilla-extract/css";

export const list = style({
    listStyle: "none",
});

export const name = style({
    minWidth: 0,
    overflowWrap: "anywhere",
});

export const score = style({
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
});
