// External on purpose: the Tauri CSP has no 'unsafe-inline', and only the embedded
// index.html gets nonces, so an inline script would not run from an OTA bundle.
if (window.__TAURI_INTERNALS__) {
    // No pinch-zoom in the native app; `data-platform` lets CSS skip the
    // phone-frame layout on tablets.
    document
        .getElementById("viewport")
        ?.setAttribute(
            "content",
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
        );
    document.documentElement.setAttribute("data-platform", "tauri");
}

// Users should install the native app, not the PWA.
window.addEventListener("beforeinstallprompt", (e) => e.preventDefault());
