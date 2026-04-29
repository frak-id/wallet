import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { zIndex } from "../../tokens.css";

const pillEnter = keyframes({
    "0%": {
        opacity: 0,
        transform: "translateY(-12px) scale(0.92)",
        backdropFilter: "blur(0px)",
    },
    "60%": {
        opacity: 1,
    },
    "100%": {
        opacity: 1,
        transform: "translateY(0) scale(1)",
        backdropFilter: "blur(16px)",
    },
});

const pillExit = keyframes({
    "0%": {
        opacity: 1,
        transform: "translateY(0) scale(1)",
        backdropFilter: "blur(16px)",
    },
    "100%": {
        opacity: 0,
        transform: "translateY(-8px) scale(0.96)",
        backdropFilter: "blur(0px)",
    },
});

const easeOutBack = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const easeIn = "cubic-bezier(0.4, 0, 1, 1)";

export const confirmationTooltipPill = style({
    display: "inline-block",
    backgroundColor: vars.surface.overlay,
    backdropFilter: "blur(16px)",
    whiteSpace: "nowrap",
    userSelect: "none",
    zIndex: zIndex.toast,
    animation: `${pillEnter} 380ms ${easeOutBack} both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});

export const confirmationTooltipPillExiting = style({
    animation: `${pillExit} 200ms ${easeIn} both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
            opacity: 0,
        },
    },
});

export const confirmationTooltipIcon = style({
    display: "inline-flex",
    flexShrink: 0,
    width: "24px",
    height: "24px",
    color: vars.icon.onAction,
});
