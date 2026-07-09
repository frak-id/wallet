import { fadeIn, fadeOut } from "@frak-labs/design-system/keyframes";
import { easing, transition } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";

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
