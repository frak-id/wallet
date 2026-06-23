import { keyframes } from "@vanilla-extract/css";

/**
 * Shared animation keyframes. Import the exported name and reference it in an
 * `animation` shorthand, e.g. `animation: ${fadeIn} 300ms ease-out`.
 */
export const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});
