import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const slide = style({
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: `0 ${alias.spacing.xl}`,
    justifyContent: "center",
    alignItems: "center",
    gap: alias.spacing.m,
});

export const slideTitle = style({
    fontSize: fontSize.xl,
    fontWeight: brand.typography.fontWeight.bold,
    textAlign: "center",
    margin: 0,
});

export const slideDescription = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
});
