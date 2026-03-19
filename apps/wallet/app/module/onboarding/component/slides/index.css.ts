import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias, brand, fontSize } from "@/tokens.css";

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
