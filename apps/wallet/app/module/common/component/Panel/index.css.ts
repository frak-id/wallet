import { vars } from "@frak-labs/design-system/theme";
import {
    alias,
    brand,
    shadow as shadowToken,
    transition,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const panel = recipe({
    base: {
        borderRadius: alias.cornerRadius.l,
        transition: `background ${transition.slow}`,
        backgroundSize: "cover",
        backgroundPosition: "-100%",
        border: `1px solid ${vars.border.default}`,
    },
    variants: {
        variant: {
            primary: {
                backgroundColor: vars.surface.elevated,
                backdropFilter: "blur(40px)",
            },
            secondary: {
                backdropFilter: "blur(40px)",
            },
            outlined: {
                border: `2px solid ${vars.border.default}`,
                background: "transparent",
            },
            empty: {
                background: "transparent",
            },
            invisible: {
                background: "transparent",
                borderColor: "transparent",
            },
        },
        size: {
            none: {
                padding: 0,
            },
            small: {
                padding: brand.scale[300],
            },
            normal: {
                padding: `${brand.scale[400]} ${brand.scale[300]}`,
            },
            big: {
                padding: `${brand.scale[700]} ${brand.scale[300]}`,
            },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "normal",
    },
});

export const shadow = style({
    boxShadow: shadowToken.panel,
});

export const dismissible = style({
    position: "relative",
});

export const dismissButton = style({
    all: "unset",
    position: "absolute",
    top: "5px",
    right: "9px",
    width: brand.scale[300],
    height: brand.scale[300],
    cursor: "pointer",
});
