import type { PushSchedule } from "./types";

/**
 * Resolve a schedule to an epoch-ms timestamp, or `undefined` when the
 * notification sends immediately or the date/time isn't fully filled in.
 * `date` is an ISO day (local midnight) from the DateField; the `HH:mm` time
 * is applied in the merchant's local timezone.
 */
export function deriveScheduledAt(schedule: PushSchedule): number | undefined {
    if (schedule.type !== "later") return undefined;
    if (!schedule.date || !schedule.time) return undefined;
    const day = new Date(schedule.date);
    if (Number.isNaN(day.getTime())) return undefined;
    const [hours, minutes] = schedule.time.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
    day.setHours(hours, minutes, 0, 0);
    return day.getTime();
}

/** "Schedule for later" is only valid once both date and time resolve. */
export function isScheduleValid(schedule: PushSchedule): boolean {
    return schedule.type === "now" || deriveScheduledAt(schedule) !== undefined;
}
