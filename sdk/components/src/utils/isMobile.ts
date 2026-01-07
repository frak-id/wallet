/**
 * Check if the current device is a mobile device
 * Uses a lightweight regex check on userAgent to avoid heavy dependencies
 *
 * @returns True if the device is mobile (iOS, Android, etc.)
 */
export function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}
