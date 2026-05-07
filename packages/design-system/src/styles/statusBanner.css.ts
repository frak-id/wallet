import { keyframes, style } from "@vanilla-extract/css";
import { alias } from "../tokens.css";

/**
 * Status banner container styles. The inner layout uses `Inline`, `Stack` and
 * `Text` from the design system. Only the fixed-position shell, safe-area
 * offset, blur backdrop and fade-in animation live here — they cannot be
 * expressed via sprinkles.
 */

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const container = style({
    position: "fixed",
    top: `max(${alias.spacing.xs}, env(safe-area-inset-top))`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: 1000,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: "#000000CC",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "#ffffff",
    animation: `${fadeIn} 300ms ease-out`,
});
