import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand } from "@/tokens.css";

export const formBlock = style({
    display: "flex",
    flexDirection: "column",
    gap: brand.scale[200],
    margin: 0,
});

export const input = style({
    margin: `${brand.scale[200]} 0`,
});

export const errorText = style({
    display: "block",
    paddingBottom: brand.scale[100],
    color: vars.text.error,
});

export const toggleButton = style({
    all: "unset",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    color: vars.icon.secondary,
});
