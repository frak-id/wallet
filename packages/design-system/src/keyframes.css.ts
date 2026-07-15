import { keyframes } from "@vanilla-extract/css";

/**
 * Shared animation keyframes. Import the exported name and reference it in an
 * `animation` shorthand, e.g. `animation: ${fadeIn} 300ms ease-out`.
 */

/** Pure opacity fade-in. */
export const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

/** Pure opacity fade-out. */
export const fadeOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

/**
 * Fade-in that settles downward into place from 4px above (banners, alerts).
 * Named per animate.css convention (starts offset upward, moves down).
 */
export const fadeInDown = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});
