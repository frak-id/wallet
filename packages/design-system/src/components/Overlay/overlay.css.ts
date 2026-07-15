import { style } from "@vanilla-extract/css";
import { fadeIn } from "../../keyframes.css";
import { vars } from "../../theme.css";
import { easing, transition, zIndex } from "../../tokens.css";

export const overlayStyle = style({
    position: "fixed",
    inset: 0,
    backgroundColor: vars.surface.overlay,
    zIndex: zIndex.modal,
    animationName: fadeIn,
    animationDuration: transition.base,
    animationTimingFunction: easing.smooth,
});
