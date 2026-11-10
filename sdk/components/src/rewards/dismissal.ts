import { sdkConfigStore } from "@frak-labs/core-sdk";

const KEY_PREFIX = "frak-reward-reminder-dismissed-";
const DISMISS_EVENT = "frak:reward-reminder-dismissed";

function storageKey(): string {
    return `${KEY_PREFIX}${sdkConfigStore.getConfig().merchantId ?? "unknown"}`;
}

/** Dismissal lasts for the browser session only, and is shared by every reminder surface. */
export function isReminderDismissed(): boolean {
    try {
        return window.sessionStorage.getItem(storageKey()) === "1";
    } catch {
        return false;
    }
}

export function dismissReminder(): void {
    try {
        window.sessionStorage.setItem(storageKey(), "1");
    } catch {
        // Storage blocked: the dismissal still holds for this page through the event.
    }
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
}

export function subscribeReminderDismissal(listener: () => void): () => void {
    window.addEventListener(DISMISS_EVENT, listener);
    return () => window.removeEventListener(DISMISS_EVENT, listener);
}
