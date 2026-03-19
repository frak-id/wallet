import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand, fontSize, transition } from "@/tokens.css";

export const back = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    marginTop: brand.scale[200],
    marginLeft: brand.scale[400],
    fontSize: fontSize.l,
    letterSpacing: "-0.02em",
    color: vars.text.primary,
});

export const backDisabled = style({
    color: vars.text.disabled,
});

export const actionButton = style({
    all: "unset",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    transition: `color ${transition.base}`,
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
        },
    },
});

export const actionText = style({
    fontSize: fontSize.l,
});
