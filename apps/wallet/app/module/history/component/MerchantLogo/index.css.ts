import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const merchantLogo = recipe({
    base: {
        borderRadius: alias.cornerRadius.full,
        border: `1px solid ${vars.border.default}`,
        flexShrink: 0,
    },
    variants: {
        size: {
            small: { width: 40, height: 40 },
            large: { width: 64, height: 64 },
        },
    },
    defaultVariants: {
        size: "small",
    },
});

export const merchantLogoImg = style({
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    objectFit: "cover",
});

export const merchantLogoFallback = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: "inherit",
        letterSpacing: "-0.03em",
        fontWeight: 600,
        color: vars.text.primary,
        background: vars.surface.background,
    },
    variants: {
        size: {
            small: { fontSize: 23 },
            large: { fontSize: 37, letterSpacing: "-0.15em" },
        },
    },
    defaultVariants: {
        size: "small",
    },
});
