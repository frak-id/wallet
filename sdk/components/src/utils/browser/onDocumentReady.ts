/**
 * When the document is ready, run the callback
 */
export function onDocumentReady(callback: () => void) {
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        setTimeout(callback, 1);
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }
}
