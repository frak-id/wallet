import { keyframes, style } from "@vanilla-extract/css";
import { alias } from "../tokens.css";

/**
 * Status banner card. Visual-only — background, blur backdrop, padding,
 * fade-in animation. Positioning (fixed top, safe-area, z-index) is owned
 * by `BannerStack` so multiple banners can stack cleanly without
 * each one reserving the same top slot.
 */

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const container = style({
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: "#000000CC",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "#ffffff",
    animation: `${fadeIn} 300ms ease-out`,
    // Re-enable pointer events on the card so screen readers / hover work,
    // while the parent `BannerStack` lets clicks pass through empty areas.
    pointerEvents: "auto",
});

/**
 * Trailing dismiss button (X) rendered when the banner is dismissable.
 * Resets the native button look and matches the icon size + color of the
 * leading status icon for visual balance.
 */
export const dismissButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 28,
    height: 28,
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "currentColor",
    cursor: "pointer",
    borderRadius: alias.cornerRadius.full,
    opacity: 0.7,
    transition: "opacity 150ms ease-out, background-color 150ms ease-out",
    selectors: {
        "&:hover": {
            opacity: 1,
            backgroundColor: "#FFFFFF1A",
        },
        "&:focus-visible": {
            opacity: 1,
            outline: "2px solid #FFFFFF66",
            outlineOffset: 2,
        },
    },
});
