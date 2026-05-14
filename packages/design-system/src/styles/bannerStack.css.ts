import { style } from "@vanilla-extract/css";
import { alias } from "../tokens.css";

/**
 * Fixed top-of-viewport container for stacked status banners. Owns the
 * safe-area offset, side margins, gap and z-index so child banners stay
 * positioning-agnostic and compose cleanly.
 */
export const stack = style({
    position: "fixed",
    top: `max(${alias.spacing.xs}, env(safe-area-inset-top))`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    pointerEvents: "none",
});
