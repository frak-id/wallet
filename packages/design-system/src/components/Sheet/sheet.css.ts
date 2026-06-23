import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { tablet } from "../../breakpoints";
import { vars } from "../../theme.css";
import { alias, easing, shadow, transition, zIndex } from "../../tokens.css";

const slideInRight = keyframes({
    from: { transform: "translate3d(100%, 0, 0)" },
    to: { transform: "translate3d(0, 0, 0)" },
});

const slideInLeft = keyframes({
    from: { transform: "translate3d(-100%, 0, 0)" },
    to: { transform: "translate3d(0, 0, 0)" },
});

const slideInTop = keyframes({
    from: { transform: "translate3d(0, -100%, 0)" },
    to: { transform: "translate3d(0, 0, 0)" },
});

const slideInBottom = keyframes({
    from: { transform: "translate3d(0, 100%, 0)" },
    to: { transform: "translate3d(0, 0, 0)" },
});

export const sheetContentBaseStyle = style({
    position: "fixed",
    zIndex: zIndex.modal + 1,
    backgroundColor: vars.surface.background2,
    boxShadow: shadow.dialog,
    display: "flex",
    flexDirection: "column",
    width: "100vw",
    maxWidth: "100vw",
    overflowY: "auto",
    animationDuration: transition.base,
    animationTimingFunction: easing.smooth,
    selectors: {
        "&:focus": { outline: "none" },
    },
});

export const sheetContentPaddedStyle = style({
    gap: alias.spacing.m,
    padding: alias.spacing.l,
});

export const sheetContentVariants = styleVariants({
    right: [
        {
            top: 0,
            right: 0,
            height: "100dvh",
            animationName: slideInRight,
        },
    ],
    left: [
        {
            top: 0,
            left: 0,
            height: "100dvh",
            animationName: slideInLeft,
        },
    ],
    top: [
        {
            top: 0,
            left: 0,
            right: 0,
            maxHeight: "85dvh",
            animationName: slideInTop,
            borderBottomLeftRadius: alias.cornerRadius.l,
            borderBottomRightRadius: alias.cornerRadius.l,
        },
    ],
    bottom: [
        {
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "85dvh",
            animationName: slideInBottom,
            borderTopLeftRadius: alias.cornerRadius.l,
            borderTopRightRadius: alias.cornerRadius.l,
        },
    ],
});

/**
 * Tablet+ width override for `right` / `left` sheets. Mobile keeps the
 * full-width base. `top` / `bottom` ignore size (always full width).
 */
export const sheetSizeVariants = styleVariants({
    default: [
        {
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    width: "420px",
                    maxWidth: "min(420px, 100vw)",
                },
            },
        },
    ],
    wide: [
        {
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    width: "640px",
                    maxWidth: "min(640px, 100vw)",
                },
            },
        },
    ],
});

export const sheetHeaderStyle = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    paddingRight: alias.spacing.xl,
});

export const sheetFooterStyle = style({
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            flexDirection: "row",
            justifyContent: "flex-end",
        },
    },
});

export const sheetTitleStyle = style({
    margin: 0,
    fontWeight: 600,
    fontSize: "18px",
    color: vars.text.primary,
});

export const sheetDescriptionStyle = style({
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});

export const sheetCloseStyle = style({
    position: "absolute",
    top: alias.spacing.m,
    right: alias.spacing.m,
    width: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    color: vars.icon.secondary,
    cursor: "pointer",
    borderRadius: alias.cornerRadius.s,
    selectors: {
        "&:hover": { backgroundColor: vars.surface.muted },
        "&:focus-visible": { outline: `2px solid ${vars.border.focus}` },
    },
});
