import { easing, transition } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes } from "@vanilla-extract/css";

/**
 * Directional view-transition animations for the in-page onboarding step
 * changes. The `html[data-onboarding-transition='…']` attribute is toggled
 * from `withStepTransition` while the View Transition is running, so the
 * router-level fade defined in `__root.css.ts` is overridden by selector
 * specificity for the duration of the step change.
 */
const SLIDE_DISTANCE = "24px";

const slideOutToLeft = keyframes({
    from: { transform: "translateX(0)", opacity: 1 },
    to: { transform: `translateX(-${SLIDE_DISTANCE})`, opacity: 0 },
});

const slideInFromRight = keyframes({
    from: { transform: `translateX(${SLIDE_DISTANCE})`, opacity: 0 },
    to: { transform: "translateX(0)", opacity: 1 },
});

const slideOutToRight = keyframes({
    from: { transform: "translateX(0)", opacity: 1 },
    to: { transform: `translateX(${SLIDE_DISTANCE})`, opacity: 0 },
});

const slideInFromLeft = keyframes({
    from: { transform: `translateX(-${SLIDE_DISTANCE})`, opacity: 0 },
    to: { transform: "translateX(0)", opacity: 1 },
});

globalStyle(
    "html[data-onboarding-transition='forward'] ::view-transition-old(root)",
    {
        animation: `${slideOutToLeft} ${transition.base} ${easing.decelerate} both`,
    }
);

globalStyle(
    "html[data-onboarding-transition='forward'] ::view-transition-new(root)",
    {
        animation: `${slideInFromRight} ${transition.base} ${easing.decelerate} both`,
    }
);

globalStyle(
    "html[data-onboarding-transition='backward'] ::view-transition-old(root)",
    {
        animation: `${slideOutToRight} ${transition.base} ${easing.decelerate} both`,
    }
);

globalStyle(
    "html[data-onboarding-transition='backward'] ::view-transition-new(root)",
    {
        animation: `${slideInFromLeft} ${transition.base} ${easing.decelerate} both`,
    }
);

globalStyle(
    "html[data-onboarding-transition] ::view-transition-old(root), html[data-onboarding-transition] ::view-transition-new(root)",
    {
        "@media": {
            "(prefers-reduced-motion: reduce)": {
                animation: "none",
            },
        },
    }
);
