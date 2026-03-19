import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "@/theme.css";

const spin = keyframes({
    from: {
        opacity: 1,
    },
    to: {
        opacity: 0.25,
    },
});

const base = style({
    display: "block",
    position: "relative",
    opacity: 0.65,
});

export const spinnerStyles = styleVariants({
    s: [
        base,
        {
            width: "16px",
            height: "16px",
        },
    ],
    m: [
        base,
        {
            width: "24px",
            height: "24px",
        },
    ],
    l: [
        base,
        {
            width: "32px",
            height: "32px",
        },
    ],
});

export const leafStyles = style({
    position: "absolute",
    top: 0,
    left: "calc(50% - 12.5% / 2)",
    width: "12.5%",
    height: "100%",
    animation: `${spin} 800ms linear infinite`,
    "::before": {
        content: '""',
        display: "block",
        width: "100%",
        height: "30%",
        borderRadius: "3px",
        backgroundColor: vars.text.tertiary,
    },
});

export const leafRotations = styleVariants({
    leaf0: {
        transform: "rotate(0deg)",
        animationDelay: "calc(-8 / 8 * 800ms)",
    },
    leaf1: {
        transform: "rotate(45deg)",
        animationDelay: "calc(-7 / 8 * 800ms)",
    },
    leaf2: {
        transform: "rotate(90deg)",
        animationDelay: "calc(-6 / 8 * 800ms)",
    },
    leaf3: {
        transform: "rotate(135deg)",
        animationDelay: "calc(-5 / 8 * 800ms)",
    },
    leaf4: {
        transform: "rotate(180deg)",
        animationDelay: "calc(-4 / 8 * 800ms)",
    },
    leaf5: {
        transform: "rotate(225deg)",
        animationDelay: "calc(-3 / 8 * 800ms)",
    },
    leaf6: {
        transform: "rotate(270deg)",
        animationDelay: "calc(-2 / 8 * 800ms)",
    },
    leaf7: {
        transform: "rotate(315deg)",
        animationDelay: "calc(-1 / 8 * 800ms)",
    },
});
