import { style } from "@vanilla-extract/css";
import { alias, safeArea, zIndex } from "../tokens.css";

/**
 * Stacked top banners, absolutely positioned within the app shell so they track
 * the main content (centered phone-frame on tablet/desktop, full width on
 * mobile/native). Owns safe-area gap, side margins and z-index.
 */
export const stack = style({
    position: "absolute",
    top: `calc(${safeArea.top} + ${alias.spacing.xs})`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: zIndex.toast,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    pointerEvents: "none",
});
