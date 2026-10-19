import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const popIn = keyframes({
    from: { opacity: 0, transform: "scale(0.9)" },
    to: { opacity: 1, transform: "scale(1)" },
});

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

export const body = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.m,
    padding: `0 ${alias.spacing.m}`,
    textAlign: "center",
});

export const amount = style({
    animation: `${popIn} 0.3s cubic-bezier(0.23, 1, 0.32, 1) both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: `${fadeIn} 0.2s ease both`,
        },
    },
});
