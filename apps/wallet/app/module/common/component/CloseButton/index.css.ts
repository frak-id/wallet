import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

const base = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    color: vars.icon.secondary,
});

export const closeButton = styleVariants({
    floating: [base],
    inline: [
        base,
        {
            position: "static",
            top: "auto",
            right: "auto",
            display: "flex",
            marginLeft: "auto",
        },
    ],
});
