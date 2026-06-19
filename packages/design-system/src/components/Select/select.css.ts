import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, easing, fontSize, transition, zIndex } from "../../tokens.css";

/**
 * Trigger — base + length variants
 */
const triggerBase = style({
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: alias.cornerRadius.s,
    padding: `0 ${alias.spacing.xs}`,
    height: "40px",
    gap: alias.spacing.xxs,
    backgroundColor: vars.surface.background,
    border: `1px solid ${vars.border.default}`,
    color: vars.text.primary,
    cursor: "pointer",
    transition: `border-color ${transition.base} ${easing.default}`,

    ":focus-visible": {
        boxShadow: `0 0 0 2px ${vars.border.focus}`,
    },

    selectors: {
        "&[data-disabled]": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});

export const triggerLength = styleVariants({
    medium: [triggerBase, { width: "320px" }],
    big: [triggerBase, { width: "100%" }],
});

/** Borderless 56px flat-card trigger — pairs with `Input variant="bare"`. */
const triggerBare = style([
    triggerBase,
    {
        width: "100%",
        height: "56px",
        padding: `0 ${alias.spacing.m}`,
        gap: alias.spacing.m,
        borderRadius: alias.cornerRadius.m,
        border: "none",
        backgroundColor: vars.surface.elevated,
        fontSize: fontSize.m,
        lineHeight: "26px",
    },
]);

const triggerBareMuted = style({
    backgroundColor: vars.surface.muted,
});

export const selectStyles = {
    trigger: triggerBase,
    triggerBare,
    triggerBareMuted,

    icon: style({
        color: vars.icon.secondary,
        flexShrink: 0,
    }),

    content: style({
        overflow: "hidden",
        backgroundColor: vars.surface.elevated,
        borderRadius: alias.cornerRadius.m,
        boxShadow: "0px 3px 4px rgba(115, 115, 115, 0.16)",
        maxHeight: "384px",
        minWidth: "var(--radix-select-trigger-width)",
        zIndex: zIndex.popover,
    }),

    viewport: style({
        padding: 0,
    }),

    item: style({
        display: "flex",
        alignItems: "center",
        height: "48px",
        fontSize: "16px",
        lineHeight: "26px",
        color: vars.text.primary,
        padding: "12px 16px",
        position: "relative",
        userSelect: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
        outline: "none",

        selectors: {
            "&[data-disabled]": {
                opacity: 0.5,
                pointerEvents: "none",
            },
            "&[data-highlighted]": {
                backgroundColor: vars.surface.secondaryHover,
            },
            '&[data-state="checked"]': {
                backgroundColor: vars.surface.secondary,
            },
        },
    }),

    label: style({
        padding: `7px 25px`,
        fontSize: fontSize.xs,
        color: vars.text.tertiary,
    }),

    separator: style({
        height: "1px",
        backgroundColor: vars.border.default,
        margin: alias.spacing.xxs,
    }),

    scrollButton: style({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "25px",
        backgroundColor: vars.surface.elevated,
        cursor: "default",
        color: vars.icon.secondary,
    }),
};
