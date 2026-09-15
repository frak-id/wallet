import { IS_IOS } from "@frak-labs/app-essentials/utils/platform";
import type { AnyRouter } from "@tanstack/react-router";
import type { FileRoutesById } from "@/routeTree.gen";

// Layout route mounting the bottom tab bar. Matched by id so child pages
// inherit it; typed so a layout rename fails to compile rather than silently
// matching nothing.
const NAV_LAYOUT_ID: keyof FileRoutesById = "/_wallet/_protected";

/** Whether both ends of a navigation render the bottom tab bar. */
export function keepsBottomBar(router: AnyRouter, from: string, to: string) {
    return [from, to].every((pathname) => {
        const [matchedRoutes] = router.getMatchedRoutes(pathname);
        return matchedRoutes.some((route) => route.id === NAV_LAYOUT_ID);
    });
}

/**
 * Whether a navigation is going backwards through the history stack.
 *
 * `__TSR_index` is what `@tanstack/history` itself diffs to classify a popstate
 * as BACK, so this reads the same signal without depending on subscriber order.
 */
function isBackNavigation(router: AnyRouter) {
    const from = router.stores.resolvedLocation.get()?.state?.__TSR_index;
    const to = router.latestLocation.state?.__TSR_index;
    return typeof from === "number" && typeof to === "number" && to < from;
}

/**
 * Skip the route crossfade where it costs more than it buys: the tab bar is
 * captured into both snapshots, where `backdrop-filter` has no live backdrop
 * and its glass washes out. Wrapping is load-bearing — `onBeforeNavigate`
 * fires too early to decide.
 *
 * On iOS the edge-swipe is also skipped on the way back: WKWebView already
 * slid its own snapshot of the destination in, so the crossfade replays the
 * screen being left and reads as a flash.
 */
export function installViewTransitionOptOut(router: AnyRouter) {
    const startViewTransition = router.startViewTransition;
    router.startViewTransition = (update) => {
        const from = router.stores.resolvedLocation.get()?.pathname;
        const to = router.latestLocation.pathname;
        if (
            !from ||
            from === to ||
            keepsBottomBar(router, from, to) ||
            (IS_IOS && isBackNavigation(router))
        ) {
            router.shouldViewTransition = false;
        }
        return startViewTransition(update);
    };
}
