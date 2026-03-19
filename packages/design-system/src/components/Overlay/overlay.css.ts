import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { easing, transition, zIndex } from "@/tokens.css";

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

export const overlayStyle = style({
    position: "fixed",
    inset: 0,
    backgroundColor: vars.surface.overlay,
    zIndex: zIndex.modal,
    animationName: fadeIn,
    animationDuration: transition.base,
    animationTimingFunction: easing.smooth,
});
