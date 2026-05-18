import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { brandColors } from "@/styles/brand";

export const buttonVariants = recipe({
    base: {
        boxSizing: "border-box",
        padding: 0,
        textAlign: "center",
        cursor: "pointer",
        outline: "none",
        display: "flex",
        alignItems: "center",
        borderRadius: alias.cornerRadius.s,
        lineHeight: 1.15,
        ":focus-visible": {
            boxShadow: `0 0 0 1px ${brand.colors.primary[500]}`,
        },
        ":disabled": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
    variants: {
        variant: {
            primary: {
                background: brandColors.buttonPrimaryBg,
                border: "1px solid transparent",
                color: brand.colors.neutral.white,
            },
            secondary: {
                background: brand.colors.neutral.white,
                border: `1px solid ${brand.colors.neutral.grey250}`,
                color: brand.colors.neutral.grey700,
            },
            outline: {
                background: "none",
                border: `1px solid ${brand.colors.neutral.grey400}`,
                color: brand.colors.neutral.grey400,
            },
            ghost: {
                background: "none",
                border: "1px solid transparent",
                color: "inherit",
            },
            submit: {
                background: brand.colors.primary[500],
                border: "1px solid transparent",
                color: brand.colors.neutral.white,
                fontWeight: 600,
            },
            informationReverse: {
                background: brand.colors.primary[500],
                border: "1px solid transparent",
                color: brand.colors.neutral.white,
            },
            danger: {
                background: brand.colors.error[600],
                border: "1px solid transparent",
                color: brand.colors.neutral.white,
            },
            information: {
                backgroundColor: brand.colors.primary[100],
                color: brand.colors.primary[500],
                border: "1px solid transparent",
            },
            informationOutline: {
                backgroundColor: brand.colors.neutral.white,
                color: brand.colors.primary[500],
                border: `1px solid ${brand.colors.primary[500]}`,
            },
            trigger: {
                backgroundColor: brand.colors.neutral.white,
                border: `1px solid ${brand.colors.neutral.grey250}`,
            },
        },
        size: {
            none: { padding: 0 },
            small: { padding: "6px 10px" },
            medium: { padding: "11px 14px 11px 14px" },
            big: { padding: "6px 22px" },
            icon: { padding: "6px" },
        },
        blur: {
            none: { backdropFilter: "none" },
            blur: { backdropFilter: "blur(80px)" },
        },
        width: {
            auto: { width: "auto" },
            full: { width: "100%" },
        },
        align: {
            left: { textAlign: "left", justifyContent: "flex-start" },
            center: { textAlign: "center", justifyContent: "center" },
            right: { textAlign: "right", justifyContent: "flex-end" },
        },
        gap: {
            none: { gap: 0 },
            small: { gap: alias.spacing.s },
            medium: { gap: "12px" },
            big: { gap: "22px" },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "medium",
        blur: "none",
        width: "auto",
        align: "center",
        gap: "small",
    },
});

export const fontNormal = style({ fontWeight: 400 });
export const fontBold = style({ fontWeight: 700 });
export const fontSizeSmall = style({ fontSize: "12px" });
export const fontSizeNormal = style({ fontSize: "14px" });
export const fontSizeBig = style({ fontSize: "16px" });
