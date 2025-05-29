import { useMemo } from "react";

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

        if (!isMeta) {
            return {
                isInAppBrowser: false,
            } as const;
        }

        // The new desired host to redirect to
        const redirectUrl = `${process.env.BACKEND_URL}/common/social?u=${encodeURIComponent(window.location.href)}`;

        // Otherwise, build the redirect url
        return {
            isInAppBrowser: true,
            redirectUrl,
        } as const;
    }, []);
}
