import { PendingLoader } from "@frak-labs/ui/component/PendingLoader";
import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
    const router = createRouter({
        routeTree,
        scrollRestoration: true,
        // Preload routes when links render for instant navigation
        defaultPreload: "render",
        defaultPreloadStaleTime: 0,
        defaultPendingMinMs: 500,
        defaultPendingComponent: PendingLoader,
    });

    // Subscribe to navigation events to manage root element attributes
    // Only run on client side to avoid SSR issues
    if (typeof document !== "undefined") {
        router.subscribe("onResolved", () => {
            const rootElement = document.querySelector(":root") as HTMLElement;
            if (!rootElement) return;

            // Set data-page attribute based on matched routes
            const isRestricted = router.state.matches.some(
                (match) => match.routeId === "/_restricted"
            );
            const isAuthentication = router.state.matches.some(
                (match) => match.routeId === "/login"
            );

            if (isRestricted) {
                rootElement.dataset.page = "restricted";
            } else if (isAuthentication) {
                rootElement.dataset.page = "authentication";
            } else {
                rootElement.removeAttribute("data-page");
            }
        });
    }

    return router;
};
