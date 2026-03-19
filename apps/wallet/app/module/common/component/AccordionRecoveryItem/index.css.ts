import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand, fontSize, transition } from "@/tokens.css";

export const trigger = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    width: "100%",
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.regular,
    fontSize: fontSize.s,
    textAlign: "left",
    transition: `color ${transition.base}`,
    selectors: {
        "&:disabled": {
            color: vars.text.disabled,
            cursor: "not-allowed",
        },
    },
});

export const triggerContent = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    width: "100%",
});

export const triggerLabel = style({
    marginRight: "auto",
});

export const triggerIcon = style({
    flexShrink: 0,
    color: vars.text.onAction,
});

export const content = style({});

globalStyle(`${content} > div`, {
    marginTop: brand.scale[500],
});
