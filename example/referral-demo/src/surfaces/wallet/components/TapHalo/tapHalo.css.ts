import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

// Starts transparent so the `backwards` fill hides the ring during the delay.
const pulse = keyframes({
    "0%": { transform: "scale(1)", opacity: 0 },
    "12%": { transform: "scale(1)", opacity: 0.9 },
    "70%, 100%": { transform: "scale(1.08, 1.4)", opacity: 0 },
});

export const wrapper = recipe({
    base: {
        position: "relative",
        isolation: "isolate",
    },
    variants: {
        fill: {
            true: { display: "flex", width: "100%" },
            false: { display: "inline-flex", alignSelf: "flex-start" },
        },
    },
});

export const ring = style({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    borderRadius: alias.cornerRadius.full,
    boxShadow: `0 0 0 3px ${vars.icon.action}`,
    pointerEvents: "none",
    animation: `${pulse} 1.8s cubic-bezier(0.2, 0.7, 0.3, 1) 1.2s infinite backwards`,
});
