import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import {
    alias,
    easing,
    fontSize,
    shadow,
    transition,
    zIndex,
} from "../../tokens.css";

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
        boxShadow: `0 0 0 1px ${vars.border.focus}`,
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

export const selectStyles = {
    trigger: triggerBase,

    icon: style({
        color: vars.icon.secondary,
        flexShrink: 0,
    }),

    content: style({
        overflow: "hidden",
        backgroundColor: vars.surface.elevated,
        border: `1px solid ${vars.border.default}`,
        borderRadius: alias.cornerRadius.s,
        boxShadow: shadow.elevated,
        maxHeight: "384px",
        minWidth: "var(--radix-select-trigger-width)",
        zIndex: zIndex.popover,
    }),

    viewport: style({
        padding: alias.spacing.xxs,
    }),

    item: style({
        fontSize: fontSize.s,
        color: vars.text.primary,
        borderRadius: alias.cornerRadius.xs,
        padding: `7px 35px 7px 25px`,
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

    itemIndicator: style({
        position: "absolute",
        left: alias.spacing.xxs,
        top: "50%",
        transform: "translateY(-50%)",
        height: "20px",
        display: "inline-flex",
        alignItems: "center",
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
