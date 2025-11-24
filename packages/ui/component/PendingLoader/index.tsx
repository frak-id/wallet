import NProgress from "nprogress";
import { useEffect } from "react";

/**
 * Configure NProgress with custom options
 *
 * Call this once at app startup to customize NProgress behavior.
 * If not called, default configuration will be used.
 */
export function configurePendingLoader(options?: NProgress.NProgressOptions) {
    NProgress.configure({
        showSpinner: false,
        minimum: 0.08,
        easing: "ease",
        speed: 400,
        trickle: true,
        trickleSpeed: 200,
        ...options,
    });
}

// Configure with defaults on module load
configurePendingLoader();

/**
 * PendingLoader component for route transitions
 *
 * Use as pendingComponent in TanStack Router.
 * Starts NProgress on mount, completes on unmount.
 * Shows NProgress bar at the top of the page.
 *
 * Note: Returns null to allow the previous route content to remain visible
 * during navigation, preventing the "empty page flash" effect.
 *
 * @example
 * ```tsx
 * // In router config
 * const router = createRouter({
 *   routeTree,
 *   defaultPendingComponent: PendingLoader,
 * });
 *
 * // Import CSS in your app
 * import "nprogress/nprogress.css";
 * ```
 */
export function PendingLoader() {
    useEffect(() => {
        NProgress.start();

        // Cleanup: complete when component unmounts (route is ready)
        return () => {
            NProgress.done();
        };
    }, []);

    // Return null to keep previous route content visible during navigation
    // This prevents the empty page flash while chunks load
    return null;
}
