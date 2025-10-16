function checkInIframe() {
    if (typeof window === "undefined") {
        return false;
    }
    return window.self !== window.top;
}

export const isInIframe = checkInIframe();

function checkInAppBrowser() {
    if (typeof navigator === "undefined") {
        return false;
    }

    const ua = navigator.userAgent.toLocaleLowerCase();
    // Check if we are in a meta embedded browser
    return (
        ua.includes("instagram") ||
        ua.includes("fban") ||
        ua.includes("fbav") ||
        ua.includes("facebook")
    );
}

export const inAppRedirectUrl = `${process.env.BACKEND_URL}/common/social?u=`;

export const isInAppBrowser = checkInAppBrowser();
