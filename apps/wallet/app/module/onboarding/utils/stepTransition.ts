import { flushSync } from "react-dom";

/**
 * Direction of the in-page onboarding transition. Mirrored into a
 * `data-onboarding-transition` attribute on `<html>` so CSS can pick a
 * matching slide animation that overrides the router-level fade.
 */
export type StepTransitionDirection = "forward" | "backward";

const ATTR = "data-onboarding-transition";

/**
 * Wrap a state update in `document.startViewTransition` to fade/slide the
 * onboarding step into view. Falls back to a synchronous update on browsers
 * without the View Transitions API (Firefox, Safari < 18), matching the
 * router's own progressive enhancement.
 */
export function withStepTransition(
    direction: StepTransitionDirection,
    update: () => void
) {
    if (
        typeof document === "undefined" ||
        typeof document.startViewTransition !== "function"
    ) {
        update();
        return;
    }

    const root = document.documentElement;
    root.setAttribute(ATTR, direction);

    const transition = document.startViewTransition(() => {
        // `flushSync` ensures React commits the state change synchronously
        // inside the view transition callback so the API can capture the
        // "new" snapshot.
        flushSync(update);
    });

    const cleanup = () => {
        if (root.getAttribute(ATTR) === direction) {
            root.removeAttribute(ATTR);
        }
    };

    transition.finished.then(cleanup, cleanup);
}
