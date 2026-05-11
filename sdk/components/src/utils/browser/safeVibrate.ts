/**
 * Attempt to vibrate the device
 */
export function safeVibrate() {
    if ("vibrate" in navigator) {
        navigator.vibrate(10);
    } else {
        console.log("Vibration not supported");
    }
}
