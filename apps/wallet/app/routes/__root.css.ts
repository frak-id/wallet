import { easing, transition } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const fadeOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

globalStyle("::view-transition-old(root)", {
    animation: `${fadeOut} ${transition.base} ${easing.decelerate} both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});

globalStyle("::view-transition-new(root)", {
    animation: `${fadeIn} ${transition.base} ${easing.decelerate} both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});
