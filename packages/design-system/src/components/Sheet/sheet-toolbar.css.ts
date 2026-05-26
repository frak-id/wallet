import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { brand, fontSize } from "../../tokens.css";

export const toolbar = style({
    top: 0,
    zIndex: 1,
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
});

export const titleBlock = style({
    minWidth: 0,
    height: "48px",
});

export const title = style({
    margin: 0,
    fontSize: fontSize.m,
    fontWeight: brand.typography.fontWeight.semiBold,
    lineHeight: "26px",
    color: vars.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
