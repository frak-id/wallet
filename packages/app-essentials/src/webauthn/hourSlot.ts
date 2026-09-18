/**
 * Format a `Date` as a UTC hour slot, e.g. `"2026-05-20T14"`. Drives the
 * temporal binding of every deterministic webauthn challenge.
 */
export function formatUtcHourSlot(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}`;
}

/**
 * The three UTC hour slots a server accepts for a challenge signed "now":
 * one hour earlier, the current hour, one hour later.
 *
 * The ±1h window absorbs clock skew between the user's device and the
 * backend, and lets a flow that straddles an hour boundary still succeed.
 */
export function utcHourSlotWindow(now?: Date): string[] {
    const reference = now ?? new Date();
    const hour = 60 * 60 * 1000;
    return [-1, 0, 1].map((offsetHours) =>
        formatUtcHourSlot(new Date(reference.getTime() + offsetHours * hour))
    );
}
