import NProgress from "nprogress";
import { useEffect } from "react";

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

configurePendingLoader();

export function PendingLoader() {
    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        };
    }, []);
    return null;
}
