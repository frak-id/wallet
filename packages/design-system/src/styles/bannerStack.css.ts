import { style } from "@vanilla-extract/css";
import { alias, zIndex } from "../tokens.css";

/**
 * Fixed top-of-viewport container for stacked status banners. Owns the
 * safe-area offset, side margins, gap and z-index so child banners stay
 * positioning-agnostic and compose cleanly. Sits a `spacing.xs` gap below the
 * safe area (status bar / notch) so banners don't butt against it.
 */
export const stack = style({
    position: "fixed",
    top: `calc(env(safe-area-inset-top) + ${alias.spacing.xs})`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: zIndex.toast,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    pointerEvents: "none",
});
