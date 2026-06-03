import { style } from "@vanilla-extract/css";
import { alias, zIndex } from "../tokens.css";

/**
 * Top container for stacked status banners. Absolutely positioned within the
 * app shell (`position: relative`) so it tracks the main content — the centered
 * phone-frame on tablet/desktop, full width on mobile and native — instead of
 * spanning the whole viewport. Owns the safe-area gap, side margins, gap and
 * z-index so child banners stay positioning-agnostic.
 */
export const stack = style({
    position: "absolute",
    top: `calc(env(safe-area-inset-top) + ${alias.spacing.xs})`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: zIndex.toast,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    pointerEvents: "none",
});
