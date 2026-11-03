import { getBackendUrl } from "../../config/environment";

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
export const isIOS: boolean = /* @__PURE__ */ checkIsIOS();

/**
 * Check if the current device is a mobile device (iOS, iPadOS, Android,
 * webOS, BlackBerry, IEMobile, Opera Mini). Reuses {@link isIOS} so the
 * iPadOS-13+ Macintosh heuristic stays in one place.
 */
export function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    if (isIOS) return true;
    return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

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
export const isInAppBrowser: boolean = /* @__PURE__ */ checkInAppBrowser();

function checkInstagramBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    return navigator.userAgent.toLowerCase().includes("instagram");
}

/**
 * Whether the current browser is Instagram's in-app browser.
 */
export const isInstagramBrowser: boolean =
    /* @__PURE__ */ checkInstagramBrowser();

/**
 * Redirect to external browser from in-app WebView. Call it from a user tap:
 * Instagram on iOS ignores the hand-off otherwise.
 *
 * - **Instagram on iOS**: `instagram://extbrowser/`, after Instagram's own confirm.
 * - **Other iOS**: `x-safari-https://` (server 302s to schemes are swallowed).
 * - **Android**: backend `/common/social`, a PDF response the WebView hands off.
 *
 * @param targetUrl - The URL to open in the external browser
 */
export function redirectToExternalBrowser(targetUrl: string): void {
    if (isIOS && isInstagramBrowser && /^https?:\/\//.test(targetUrl)) {
        // Instagram silently drops x-safari-* since its v417 (March 2026).
        window.location.href = `instagram://extbrowser/?url=${encodeURIComponent(targetUrl)}`;
    } else if (isIOS && targetUrl.startsWith("https://")) {
        window.location.href = `x-safari-https://${targetUrl.slice(8)}`;
    } else if (isIOS && targetUrl.startsWith("http://")) {
        window.location.href = `x-safari-http://${targetUrl.slice(7)}`;
    } else {
        window.location.href = `${getBackendUrl()}/common/social?u=${encodeURIComponent(targetUrl)}`;
    }
}
