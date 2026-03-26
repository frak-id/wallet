import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const slide = style({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const slideImg = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
});

export const slideImgCenter = style({
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
});
