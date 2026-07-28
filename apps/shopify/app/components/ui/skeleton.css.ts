import { keyframes, style } from "@vanilla-extract/css";

const skeletonPulse = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.6 },
});

export const pulse = style({
    backgroundColor: "#e4e5e7",
    borderRadius: 4,
    animation: `${skeletonPulse} 1.5s ease-in-out infinite`,
});
