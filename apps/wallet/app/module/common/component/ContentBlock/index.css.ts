import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const icon = style({
    display: "flex",
    justifyContent: "center",
});

export const title = style({
    fontSize: fontSize["2xl"],
    fontWeight: brand.typography.fontWeight.bold,
    textAlign: "center",
    margin: 0,
});

export const description = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: brand.scale[300],
    alignItems: "center",
});
