import { keyframes, style } from "@vanilla-extract/css";
import {
    CHECK_LENGTH,
    CIRCUMFERENCE,
} from "./progressCheckIconAnimated.constants";

const arcGrow = keyframes({
    from: { strokeDashoffset: CIRCUMFERENCE },
    to: { strokeDashoffset: 0 },
});

const checkDraw = keyframes({
    from: { strokeDashoffset: CHECK_LENGTH },
    to: { strokeDashoffset: 0 },
});

const checkPop = keyframes({
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.18)" },
    "100%": { transform: "scale(1)" },
});

const easing = "cubic-bezier(0.25, 0.1, 0.25, 1)";
const easeOutBack = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export const progressArcAnimated = style({
    animation: `${arcGrow} 600ms ${easing} 100ms both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
            strokeDashoffset: 0,
        },
    },
});

export const checkAnimated = style({
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: [
        `${checkDraw} 300ms ${easing} 600ms both`,
        `${checkPop} 250ms ${easeOutBack} 900ms both`,
    ].join(", "),
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
            strokeDashoffset: 0,
        },
    },
});
