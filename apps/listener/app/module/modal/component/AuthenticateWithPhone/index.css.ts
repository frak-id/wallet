import { keyframes, style } from "@vanilla-extract/css";

const fadeInKeyframes = keyframes({
    from: {
        opacity: 0,
        transform: "translateY(-5px)",
        maxHeight: 0,
    },
    to: {
        opacity: 1,
        transform: "translateY(0)",
        maxHeight: "500px",
    },
});

export const authenticateWithPhone__fadeIn = style({
    margin: "20px",
    opacity: 1,
    overflow: "hidden",
    maxHeight: 0,
    animationName: fadeInKeyframes,
    animationDuration: "0.3s",
    animationTimingFunction: "ease-in-out",
    animationFillMode: "forwards",
});
