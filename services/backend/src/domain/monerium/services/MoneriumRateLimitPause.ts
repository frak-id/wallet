export const DEFAULT_RATE_LIMIT_PAUSE_MS = 60_000;

/** Set by any 429 from Monerium. Background polling stops while it holds; user-facing calls go through. */
export class MoneriumRateLimitPause {
    private until = 0;

    pause(retryAfterSeconds?: number, now = Date.now()): void {
        const durationMs =
            retryAfterSeconds === undefined
                ? DEFAULT_RATE_LIMIT_PAUSE_MS
                : retryAfterSeconds * 1000;
        this.until = Math.max(this.until, now + durationMs);
    }

    isPaused(now = Date.now()): boolean {
        return now < this.until;
    }
}
