/**
 * Check if the current device is a mobile device
 * Uses UA regex + iPad desktop mode heuristic (maxTouchPoints)
 *
 * iPadOS 13+ sends a Macintosh UA in desktop mode, so the regex alone
 * misses it. The maxTouchPoints check catches iPads reporting as Mac.
 *
 * @returns True if the device is mobile (iOS, Android, iPadOS, etc.)
 */
export function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;

    // Standard mobile UA check
    if (
        /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )
    ) {
        return true;
    }

    // iPad desktop mode: reports "Macintosh" UA but has touch support
    if (
        /Macintosh/i.test(navigator.userAgent) &&
        navigator.maxTouchPoints > 1
    ) {
        return true;
    }

    return false;
}
