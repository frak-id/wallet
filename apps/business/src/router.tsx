import { createRouter } from "@tanstack/react-router";
import { PendingLoader } from "@/module/common/component/PendingLoader";

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

    return router;
};
