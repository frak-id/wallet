import { useRouterState } from "@tanstack/react-router";
import NProgress from "nprogress";
import { useEffect } from "react";

export function TopLoader() {
    NProgress.configure({ showSpinner: false });
    const router = useRouterState();

    const isLoading = router.status === "pending";

    useEffect(() => {
        if (isLoading) {
            NProgress.start();
        } else {
            NProgress.done();
        }
    }, [isLoading]);

    return null;
}
