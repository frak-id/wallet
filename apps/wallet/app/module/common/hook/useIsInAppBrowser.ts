import { useMemo } from "react";

/**
 * Simple helper to check if we currently are in an iframe
 */
function isInIframe() {
    if (typeof window === "undefined") {
        return false;
    }
    return window.self !== window.top;
}

/**
 * Small hook checking if we are in an in-app browser or not
 */
export function useIsInAppBrowser() {
    return useMemo(() => {
        const ua = navigator.userAgent.toLocaleLowerCase();
        // Check if we are in a meta embedded browser
        const isMeta =
            ua.includes("instagram") ||
            ua.includes("fban") ||
            ua.includes("fbav") ||
            ua.includes("facebook");

        const inIframe = isInIframe();

        if (!isMeta) {
            return {
                isInAppBrowser: false,
                isInIframe: inIframe,
            } as const;
        }

        // The new desired host to redirect to
        const redirectUrl = `${process.env.BACKEND_URL}/common/social?u=`;

        // Otherwise, build the redirect url
        return {
            isInAppBrowser: true,
            isInIframe: inIframe,
            redirectUrl,
        } as const;
    }, []);
}
