import { PendingLoader } from "@frak-labs/ui/component/PendingLoader";
import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
    return createRouter({
        routeTree,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultPendingMinMs: 500,
        defaultPendingComponent: PendingLoader,
    });
};
