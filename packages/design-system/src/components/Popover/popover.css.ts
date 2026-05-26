import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

const slideUpAndFade = keyframes({
    from: { opacity: 0, transform: "translateY(2px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const slideRightAndFade = keyframes({
    from: { opacity: 0, transform: "translateX(-2px)" },
    to: { opacity: 1, transform: "translateX(0)" },
});

const slideDownAndFade = keyframes({
    from: { opacity: 0, transform: "translateY(-2px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const slideLeftAndFade = keyframes({
    from: { opacity: 0, transform: "translateX(2px)" },
    to: { opacity: 1, transform: "translateX(0)" },
});

export const popoverContentStyle = style({
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    boxShadow: "0 4px 16px 0 rgba(115, 115, 115, 0.2)",
    animationDuration: "400ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform, opacity",
    color: vars.text.primary,
    selectors: {
        '&[data-state="open"][data-side="top"]': {
            animationName: slideDownAndFade,
        },
        '&[data-state="open"][data-side="right"]': {
            animationName: slideLeftAndFade,
        },
        '&[data-state="open"][data-side="bottom"]': {
            animationName: slideUpAndFade,
        },
        '&[data-state="open"][data-side="left"]': {
            animationName: slideRightAndFade,
        },
    },
});
