import { vars } from "@frak-labs/design-system/theme";
import { alias, easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

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
