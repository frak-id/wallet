import { keyframes, style } from "@vanilla-extract/css";
import { brand, easing, transition } from "@/tokens.css";

const fadeIn = keyframes({
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
    margin: brand.scale[500],
    animation: `${fadeIn} ${transition.slow} ${easing.inOut} forwards`,
    opacity: 1,
    overflow: "hidden",
    maxHeight: 0,
});
