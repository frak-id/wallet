import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

const panelBase = style({});

globalStyle(`${panelBase} + ${panelBase}`, {
    marginTop: alias.spacing.l,
});

export const panelVariants = recipe({
    base: [
        panelBase,
        {
            padding: alias.spacing.l,
            border: `1px solid ${vars.border.default}`,
            background: vars.surface.elevated,
            boxShadow: "0 2px 2px 0 #1018281a",
            color: vars.text.secondary,
            fontWeight: 400,
            selectors: {
                '&[aria-disabled="true"]': {
                    opacity: 0.64,
                    cursor: "not-allowed",
                },
            },
        },
    ],
    variants: {
        variant: {
            primary: { borderRadius: alias.cornerRadius.s },
            secondary: { borderRadius: 0 },
            ghost: {
                padding: 0,
                border: 0,
                background: "transparent",
                boxShadow: "none",
                color: brand.colors.neutral.white,
            },
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export const panelTitle = style({
    marginBottom: "14px",
    color: vars.text.primary,
});

export const panelTitleGhost = style({
    color: brand.colors.neutral.white,
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.bold,
});
