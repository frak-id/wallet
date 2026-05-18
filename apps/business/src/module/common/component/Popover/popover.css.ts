import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

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

export const popover = style({
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.elevated,
    boxShadow:
        "hsl(206 22% 7% / 35%) 0 10px 38px -10px, hsl(206 22% 7% / 20%) 0 10px 20px -15px",
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
