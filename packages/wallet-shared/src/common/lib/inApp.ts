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

function checkIsIPad() {
    if (typeof navigator === "undefined") {
        return false;
    }
    const ua = navigator.userAgent;
    // iPadOS 13+ reports as Macintosh — detect via touch support
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    // Pre-iPadOS 13
    if (/iPad/i.test(ua)) return true;
    return false;
}

export const isIPad = checkIsIPad();
