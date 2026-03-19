import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias, easing, transition } from "@/tokens.css";

export const link = style({
    display: "inline-block",
    marginTop: alias.spacing.m,
    color: vars.text.primary,
    textDecoration: "none",
    transition: `color ${transition.base} ${easing.default}`,
    ":hover": {
        color: vars.text.secondary,
    },
});
