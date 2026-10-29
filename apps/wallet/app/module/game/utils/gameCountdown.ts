const HOUR = 3_600_000;

/** Time left until `endsAt`; `urgent` under 24 h, `over` once it is reached. `hours` is the remainder of whole days. */
export function countdownOf(endsAt: Date | string, now: number) {
    const ms = Math.max(0, new Date(endsAt).getTime() - now);
    const totalHours = Math.floor(ms / HOUR);
    return {
        days: Math.floor(totalHours / 24),
        hours: totalHours % 24,
        minutes: Math.floor((ms % HOUR) / 60_000),
        urgent: ms < 24 * HOUR,
        over: ms === 0,
    };
}
