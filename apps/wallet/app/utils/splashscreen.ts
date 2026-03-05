const MIN_DISPLAY_MS = 2000;

declare global {
    interface Window {
        __SPLASH_SHOWN_AT__?: number;
    }
}

/**
 * Dismiss the splash overlay from index.html.
 * Waits at least {@link MIN_DISPLAY_MS} from when the overlay was shown
 * so the transition feels intentional, then fades it out.
 */
export function closeSplashscreen() {
    const splash = document.getElementById("splash-overlay");
    if (!splash) return;

    const shownAt = window.__SPLASH_SHOWN_AT__ ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
        splash.style.opacity = "0";

        // Remove on transition end, with a fallback timeout
        // in case the transitionend event never fires (e.g. jsdom, reduced motion)
        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            splash.remove();
        };

        splash.addEventListener("transitionend", remove, { once: true });
        setTimeout(remove, 350);
    }, delay);
}
