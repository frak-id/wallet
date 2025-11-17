import { useRouterState } from "@tanstack/react-router";
import NProgress from "nprogress";
import { useEffect, useState } from "react";

/**
 * Delay in ms before showing the loading bar
 * Prevents flashing on fast navigations
 */
const PENDING_DELAY_MS = 200;

export function TopLoader() {
    NProgress.configure({ showSpinner: false });
    const router = useRouterState();
    const [showLoader, setShowLoader] = useState(false);

    const isLoading = router.status === "pending";

    // Delay showing loader to avoid flashing on fast navigations
    useEffect(() => {
        if (isLoading) {
            const timeout = setTimeout(() => {
                setShowLoader(true);
            }, PENDING_DELAY_MS);

            return () => clearTimeout(timeout);
        }

        // Immediately hide loader when loading completes
        setShowLoader(false);
    }, [isLoading]);

    useEffect(() => {
        if (showLoader) {
            NProgress.start();
        } else {
            NProgress.done();
        }
    }, [showLoader]);

    return null;
}
