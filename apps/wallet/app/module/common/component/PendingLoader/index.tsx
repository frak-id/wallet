import NProgress from "nprogress";
import { useEffect } from "react";

// Configure NProgress once
NProgress.configure({
    showSpinner: false,
    minimum: 0.08,
    easing: "ease",
    speed: 400,
    trickle: true,
    trickleSpeed: 200,
});

/**
 * PendingLoader component for route transitions
 *
 * Used as pendingComponent in TanStack Router.
 * Starts NProgress on mount, completes on unmount.
 * TanStack Router unmounts this exactly when the new route is ready.
 */
export function PendingLoader() {
    useEffect(() => {
        NProgress.start();

        // Cleanup: complete when component unmounts (route is ready)
        return () => {
            NProgress.done();
        };
    }, []);

    return null;
}
