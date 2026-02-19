/**
 * In-memory sliding window rate limiter.
 *
 * Tracks timestamps of recent actions per key and rejects when the
 * count within `windowMs` exceeds `maxRequests`.
 *
 * Stale entries are pruned lazily on each `consume()` call and
 * periodically via a background sweep to prevent memory leaks from
 * keys that stop appearing.
 */
export class InMemoryRateLimiter {
    private readonly buckets = new Map<string, number[]>();
    private readonly sweepInterval: NodeJS.Timeout;

    constructor(
        private readonly windowMs: number,
        private readonly maxRequests: number
    ) {
        this.sweepInterval = setInterval(
            () => this.sweep(),
            Math.max(windowMs * 2, 60_000)
        );
    }

    consume(key: string): boolean {
        const now = Date.now();
        const cutoff = now - this.windowMs;

        let timestamps = this.buckets.get(key);
        if (timestamps) {
            timestamps = timestamps.filter((t) => t > cutoff);
        } else {
            timestamps = [];
        }

        if (timestamps.length >= this.maxRequests) {
            this.buckets.set(key, timestamps);
            return false;
        }

        timestamps.push(now);
        this.buckets.set(key, timestamps);
        return true;
    }

    private sweep() {
        const cutoff = Date.now() - this.windowMs;
        for (const [key, timestamps] of this.buckets) {
            const valid = timestamps.filter((t) => t > cutoff);
            if (valid.length === 0) {
                this.buckets.delete(key);
            } else {
                this.buckets.set(key, valid);
            }
        }
    }

    destroy() {
        clearInterval(this.sweepInterval);
        this.buckets.clear();
    }
}
