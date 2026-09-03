import type { AnyRouter } from "@tanstack/react-router";
import type { FileRoutesById } from "@/routeTree.gen";

// Layout route mounting the bottom tab bar. Matched by id so child pages
// inherit it; typed so a layout rename fails to compile rather than silently
// matching nothing.
const NAV_LAYOUT_ID: keyof FileRoutesById = "/_wallet/_protected";

/** Whether both ends of a navigation render the bottom tab bar. */
export function keepsBottomBar(router: AnyRouter, from: string, to: string) {
    return [from, to].every((pathname) =>
        router
            .getMatchedRoutes(pathname)
            .matchedRoutes.some((route) => route.id === NAV_LAYOUT_ID)
    );
}

/**
 * Skip the route crossfade where it costs more than it buys: the tab bar is
 * captured into both snapshots, where `backdrop-filter` has no live backdrop
 * and its glass washes out. Wrapping is load-bearing — `types` is only
 * consulted on Safari 18.2+, and `onBeforeNavigate` fires too early.
 */
export function installViewTransitionOptOut(router: AnyRouter) {
    const startViewTransition = router.startViewTransition;
    router.startViewTransition = (update) => {
        const from = router.stores.resolvedLocation.get()?.pathname;
        const to = router.latestLocation.pathname;
        if (!from || from === to || keepsBottomBar(router, from, to)) {
            router.shouldViewTransition = false;
        }
        return startViewTransition(update);
    };
}
