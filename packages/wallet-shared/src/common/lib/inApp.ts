function checkInIframe() {
    if (typeof window === "undefined") {
        return false;
    }
    return window.self !== window.top;
}

export const isInIframe = checkInIframe();

function checkIsIOS() {
    if (typeof navigator === "undefined") {
        return false;
    }
    const ua = navigator.userAgent;
    // Standard iOS devices
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+ reports as Macintosh — detect via touch support
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
}

export const isIOS = checkIsIOS();

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

/**
 * Redirect to external browser from in-app WebView.
 *
 * iOS: Uses x-safari-https:// scheme directly — server-side 302 redirects
 * to custom URL schemes are silently swallowed by WKWebView (Instagram,
 * Facebook, etc.). Direct window.location.href assignment to x-safari-https://
 * IS forwarded to the OS URL handler (confirmed iOS 17+).
 *
 * Android: Uses backend /common/social endpoint which returns a PDF
 * Content-Type response, forcing the WebView to hand off to the default browser.
 */
export function redirectToExternalBrowser(targetUrl: string) {
    if (isIOS && targetUrl.startsWith("https://")) {
        window.location.href = `x-safari-https://${targetUrl.slice(8)}`;
    } else if (isIOS && targetUrl.startsWith("http://")) {
        window.location.href = `x-safari-http://${targetUrl.slice(7)}`;
    } else {
        window.location.href = `${inAppRedirectUrl}${encodeURIComponent(targetUrl)}`;
    }
}
