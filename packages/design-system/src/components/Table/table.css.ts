import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, brand, fontSize } from "../../tokens.css";

export const wrapper = style({
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
    width: "100%",
});

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
});

const cellAlign = {
    left: { textAlign: "left" },
    center: { textAlign: "center" },
    right: { textAlign: "right" },
} as const;

/** Shrink the column to its widest content. */
const cellHug = {
    true: {
        width: "1%",
        whiteSpace: "nowrap" as const,
    },
};

export const headerCell = recipe({
    base: {
        height: "48px",
        backgroundColor: vars.surface.tertiary,
        fontSize: fontSize.s,
        lineHeight: "22px",
        fontWeight: brand.typography.fontWeight.medium,
        color: vars.text.secondary,
        paddingLeft: alias.spacing.s,
        paddingRight: alias.spacing.s,
        boxShadow: `inset 0 -1px 0 ${vars.border.subtle}`,
    },
    variants: {
        align: cellAlign,
        hug: cellHug,
    },
    defaultVariants: {
        align: "left",
    },
});

export const cell = recipe({
    base: {
        height: "56px",
        backgroundColor: vars.surface.background,
        fontSize: fontSize.s,
        lineHeight: "22px",
        color: vars.text.primary,
        paddingLeft: alias.spacing.s,
        paddingRight: alias.spacing.s,
        boxShadow: `inset 0 -1px 0 ${vars.border.subtle}`,
    },
    variants: {
        align: cellAlign,
        hug: cellHug,
        muted: {
            true: {
                color: vars.text.secondary,
            },
        },
    },
    defaultVariants: {
        align: "left",
    },
});
