import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { recipe } from "@vanilla-extract/recipes";
import { touchTarget } from "@/module/common/styles/touchTarget.css";

export const closeButton = recipe({
    base: {
        position: "absolute",
        top: alias.spacing.xs,
        right: alias.spacing.xs,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: vars.icon.secondary,
        ...touchTarget,
    },
    variants: {
        variant: {
            floating: {},
            inline: {
                position: "relative",
                top: "auto",
                right: "auto",
                display: "flex",
                marginLeft: "auto",
            },
        },
    },
    defaultVariants: {
        variant: "floating",
    },
});
