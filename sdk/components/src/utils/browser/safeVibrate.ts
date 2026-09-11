/**
 * Attempt to vibrate the device
 */
export function safeVibrate() {
    if ("vibrate" in navigator) {
        navigator.vibrate(10);
    }
}
