import { alias } from "@frak-labs/design-system/tokens";
import { keyframes } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

const pulse = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.45 },
});

/** A text placeholder on the hero's gradient, where the grey `Skeleton` would read as a hole. */
export const heroLine = recipe({
    base: {
        display: "block",
        height: 14,
        borderRadius: alias.cornerRadius.full,
        background: "rgba(255, 255, 255, 0.3)",
        animation: `${pulse} 1.4s ease-in-out infinite`,
        "@media": {
            "(prefers-reduced-motion: reduce)": { animation: "none" },
        },
    },
    variants: {
        width: {
            long: { width: "70%" },
            short: { width: "45%" },
        },
    },
});
