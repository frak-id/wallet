import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand, fontSize } from "@/tokens.css";

export const icon = style({
    width: "80px",
    height: "80px",
    borderRadius: brand.scale.full,
    backgroundColor: vars.surface.muted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: fontSize["3xl"],
    alignSelf: "center",
});

export const title = style({
    fontSize: fontSize.xl,
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
