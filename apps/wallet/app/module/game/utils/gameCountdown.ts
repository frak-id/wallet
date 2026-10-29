const HOUR = 3_600_000;

/** Time left until `endsAt`, rounded up to the minute; `urgent` under 24 h, `over` once it is reached. `hours` is the remainder of whole days. */
export function countdownOf(endsAt: Date | string, now: number) {
    const ms = Math.max(0, new Date(endsAt).getTime() - now);
    const totalMinutes = Math.ceil(ms / 60_000);
    return {
        days: Math.floor(totalMinutes / 1440),
        hours: Math.floor(totalMinutes / 60) % 24,
        minutes: totalMinutes % 60,
        urgent: ms < 24 * HOUR,
        over: ms === 0,
    };
}
