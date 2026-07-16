import { alias, easing, transition } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

/**
 * Overlays the top-right of the card hero. The icon reads white over the image,
 * so an 8px padding grows the tap target to 40px while keeping the 24px glyph
 * pinned 16px from the card's top/right edges.
 */
export const button = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: alias.spacing.xs,
    border: "none",
    background: "none",
    color: alias.neutral.white,
    cursor: "pointer",
});

/**
 * Playful overshoot on the glyph when a brand is favorited: a quick scale-up
 * that settles back, so the tap feels acknowledged.
 */
const pop = keyframes({
    "0%": { transform: "scale(1)" },
    "35%": { transform: "scale(1.35)" },
    "65%": { transform: "scale(0.9)" },
    "100%": { transform: "scale(1)" },
});

export const icon = style({
    display: "block",
    transformOrigin: "center",
});

export const iconPop = style({
    animation: `${pop} ${transition.slow} ${easing.decelerate}`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});
