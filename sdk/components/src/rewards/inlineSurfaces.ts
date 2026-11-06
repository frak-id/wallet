const surfaces = new Set<symbol>();
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) listener();
}

/** An inline surface currently showing the claim prompt; the floating pill stays hidden meanwhile. */
export function registerInlineReminder(): () => void {
    const token = Symbol("inline-reminder");
    surfaces.add(token);
    notify();
    return () => {
        if (surfaces.delete(token)) notify();
    };
}

export function hasInlineReminder(): boolean {
    return surfaces.size > 0;
}

export function subscribeInlineReminders(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
