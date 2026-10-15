import type { Transition } from "motion/react";

export const ANIMATION_DURATION_MS = 1100;

export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
    type: "tween",
    duration: ANIMATION_DURATION_MS / 1000,
    ease: [0.85, 0, 0.15, 1],
};
