/**
 * Check if the current device runs iOS (including iPadOS 13+).
 */
function checkIsIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // Standard iOS devices
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS 13+ reports as Macintosh — detect via touch support
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
}

/**
 * Whether the current device runs iOS (including iPadOS 13+).
 */
export const isIOS: boolean = checkIsIOS();

/**
 * Check if the current browser is a social media in-app browser
 * (Instagram, Facebook WebView).
 */
function checkInAppBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent.toLowerCase();
    return (
        ua.includes("instagram") ||
        ua.includes("fban") ||
        ua.includes("fbav") ||
        ua.includes("facebook")
    );
}

/**
 * Whether the current browser is a social media in-app browser
 * (Instagram, Facebook).
 */
export const isInAppBrowser: boolean = checkInAppBrowser();

/**
 * Redirect to external browser from in-app WebView.
 *
 * - **iOS**: Uses `x-safari-https://` scheme — server-side 302 redirects
 *   to custom URL schemes are silently swallowed by WKWebView.
 *   Direct `window.location.href` assignment works (confirmed iOS 17+).
 *
 * - **Android**: Uses backend `/common/social` endpoint which returns a PDF
 *   Content-Type response, forcing the WebView to hand off to the default browser.
 *
 * @param targetUrl - The URL to open in the external browser
 */
export function redirectToExternalBrowser(targetUrl: string): void {
    if (isIOS && targetUrl.startsWith("https://")) {
        window.location.href = `x-safari-https://${targetUrl.slice(8)}`;
    } else if (isIOS && targetUrl.startsWith("http://")) {
        window.location.href = `x-safari-http://${targetUrl.slice(7)}`;
    } else {
        window.location.href = `${process.env.BACKEND_URL}/common/social?u=${encodeURIComponent(targetUrl)}`;
    }
}
