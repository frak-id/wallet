/** Matches the `#boot-splash` opacity transition in `index.html`. */
const FADE_MS = 200;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

function getSplash(): HTMLElement | null {
    return document.getElementById("boot-splash");
}

/** Writes the line under the logo; `null` fades it out. */
export function setBootSplashStatus(text: string | null): void {
    const status = getSplash()?.querySelector(".boot-splash-status");
    const line = status?.querySelector(".boot-splash-text");
    if (!status || !line) return;
    line.textContent = text ?? "";
    status.toggleAttribute("data-visible", text !== null);
}

export function hideBootSplash(): void {
    const splash = getSplash();
    if (!splash || splash.hidden || hideTimer) return;
    splash.toggleAttribute("data-leaving", true);
    hideTimer = setTimeout(() => {
        hideTimer = undefined;
        splash.hidden = true;
        splash.removeAttribute("data-leaving");
        setBootSplashStatus(null);
    }, FADE_MS);
}

/** Covers the app again before a reload, so the next boot's splash takes over without a blank frame. */
export function showBootSplash(): void {
    const splash = getSplash();
    if (!splash) return;
    clearTimeout(hideTimer);
    hideTimer = undefined;
    splash.hidden = false;
    splash.removeAttribute("data-leaving");
}
