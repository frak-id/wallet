/** The `#boot-splash[data-leaving]` transition in `index.html`: 90 ms delay + 160 ms fade. */
const EXIT_MS = 250;
/** The `.boot-splash-status` opacity transition in `index.html`. */
const STATUS_FADE_MS = 250;

function getSplash(): HTMLElement | null {
    return document.getElementById("boot-splash");
}

function getStatus() {
    const status = getSplash()?.querySelector(".boot-splash-status");
    const line = status?.querySelector(".boot-splash-text");
    return status && line ? { status, line } : null;
}

/** Writes the line under the logo; `null` fades it out, keeping the text until it is gone. */
export function setBootSplashStatus(text: string | null): void {
    const parts = getStatus();
    if (!parts) return;
    if (text !== null) parts.line.textContent = text;
    parts.status.toggleAttribute("data-visible", text !== null);
}

/** Fades the line out and resolves once it is invisible. */
export function clearBootSplashStatus(): Promise<void> {
    const wasVisible = getStatus()?.status.hasAttribute("data-visible");
    setBootSplashStatus(null);
    if (!wasVisible) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, STATUS_FADE_MS));
}

let exit: Promise<void> | undefined;

/** Plays the exit; resolves once the splash is gone (at once when there is none). */
export function hideBootSplash(): Promise<void> {
    const splash = getSplash();
    if (!splash || splash.hidden) return Promise.resolve();
    if (exit) return exit;
    splash.toggleAttribute("data-leaving", true);
    exit = new Promise((resolve) =>
        setTimeout(() => {
            splash.hidden = true;
            splash.removeAttribute("data-leaving");
            setBootSplashStatus(null);
            const parts = getStatus();
            if (parts) parts.line.textContent = "";
            exit = undefined;
            resolve();
        }, EXIT_MS)
    );
    return exit;
}
