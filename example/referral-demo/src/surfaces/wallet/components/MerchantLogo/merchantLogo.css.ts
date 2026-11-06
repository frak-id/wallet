import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { recipe } from "@vanilla-extract/recipes";
import { merchant } from "@/data/merchant";

export const merchantLogo = recipe({
    base: {
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        border: `1px solid ${vars.border.default}`,
        background: merchant.palette.paper,
    },
    variants: {
        size: {
            header: {
                width: 24,
                height: 24,
                borderRadius: alias.cornerRadius.xs,
            },
            small: {
                width: 40,
                height: 40,
                borderRadius: alias.cornerRadius.full,
            },
            large: {
                width: 64,
                height: 64,
                borderRadius: alias.cornerRadius.full,
            },
        },
    },
    defaultVariants: { size: "small" },
});
