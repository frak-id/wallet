import {
    createVar,
    keyframes,
    style,
    styleVariants,
} from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";

const spinDuration = createVar();

const spin = keyframes({
    from: {
        opacity: 1,
    },
    to: {
        opacity: 0.25,
    },
});

export const spinnerStyles = recipe({
    base: {
        display: "block",
        position: "relative",
        opacity: 0.65,
    },
    variants: {
        size: {
            s: { width: "16px", height: "16px" },
            m: { width: "24px", height: "24px" },
            l: { width: "32px", height: "32px" },
        },
    },
    defaultVariants: {
        size: "m",
    },
});

export const leafStyles = style({
    position: "absolute",
    top: 0,
    left: "calc(50% - 12.5% / 2)",
    width: "12.5%",
    height: "100%",
    vars: { [spinDuration]: "800ms" },
    animation: `${spin} ${spinDuration} linear infinite`,
    "@media": {
        // Opacity only, no movement: slowed rather than stopped so it still reads as loading.
        "(prefers-reduced-motion: reduce)": {
            vars: { [spinDuration]: "2400ms" },
        },
    },
    "::before": {
        content: '""',
        display: "block",
        width: "100%",
        height: "30%",
        borderRadius: "3px",
        backgroundColor: vars.text.tertiary,
    },
});

// Kept as `styleVariants`: an enumerated map iterated over in the component
// (one leaf per key), not selected by a component prop — the niche where
// `styleVariants` beats `recipe`.
export const leafRotations = styleVariants({
    leaf0: {
        transform: "rotate(0deg)",
        animationDelay: `calc(-8 / 8 * ${spinDuration})`,
    },
    leaf1: {
        transform: "rotate(45deg)",
        animationDelay: `calc(-7 / 8 * ${spinDuration})`,
    },
    leaf2: {
        transform: "rotate(90deg)",
        animationDelay: `calc(-6 / 8 * ${spinDuration})`,
    },
    leaf3: {
        transform: "rotate(135deg)",
        animationDelay: `calc(-5 / 8 * ${spinDuration})`,
    },
    leaf4: {
        transform: "rotate(180deg)",
        animationDelay: `calc(-4 / 8 * ${spinDuration})`,
    },
    leaf5: {
        transform: "rotate(225deg)",
        animationDelay: `calc(-3 / 8 * ${spinDuration})`,
    },
    leaf6: {
        transform: "rotate(270deg)",
        animationDelay: `calc(-2 / 8 * ${spinDuration})`,
    },
    leaf7: {
        transform: "rotate(315deg)",
        animationDelay: `calc(-1 / 8 * ${spinDuration})`,
    },
});
