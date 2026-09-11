import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, transition } from "@frak-labs/design-system/tokens";
import { recipe } from "@vanilla-extract/recipes";

export const panel = recipe({
    base: {
        position: "relative",
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
