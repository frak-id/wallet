import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const slide = style({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const slideImage = style({
    height: "374px",
    overflow: "hidden",
});

export const slideImg = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
});

export const slideTitle = style({
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const slideDescription = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});
