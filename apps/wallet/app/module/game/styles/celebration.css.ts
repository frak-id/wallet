import { fadeIn } from "@frak-labs/design-system/keyframes";
import { keyframes, style } from "@vanilla-extract/css";

const popIn = keyframes({
    from: { opacity: 0, transform: "scale(0.9)" },
    to: { opacity: 1, transform: "scale(1)" },
});

/** The amount a celebration leads with: it pops in, or only fades with reduced motion. */
export const celebrationAmount = style({
    animation: `${popIn} 0.3s cubic-bezier(0.23, 1, 0.32, 1) both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: `${fadeIn} 0.2s ease both`,
        },
    },
});
