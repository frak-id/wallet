/**
 * When the document is ready, run the callback
 * @param callback
 */
export function onDocumentReady(callback: () => void) {
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        setTimeout(callback, 1);
    } else if (document.addEventListener) {
        document.addEventListener("DOMContentLoaded", callback);
    } else {
        // @ts-expect-error
        document.attachEvent("onreadystatechange", () => {
            if (document.readyState === "complete") {
                callback();
            }
        });
    }
}
