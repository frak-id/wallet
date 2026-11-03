const MAX_ENTRIES = 1000;

/** Shares one in-flight or recent result per key for `ttlMs`. Failures are never kept. */
export class TtlCoalescer<T> {
    private readonly entries = new Map<
        string,
        { until: number; promise: Promise<T> }
    >();

    constructor(private readonly ttlMs: number) {}

    run(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
        const hit = this.entries.get(key);
        if (hit && hit.until > now) return hit.promise;

        if (this.entries.size >= MAX_ENTRIES) this.prune(now);
        const promise = load();
        this.entries.set(key, { until: now + this.ttlMs, promise });
        promise.catch(() => {
            if (this.entries.get(key)?.promise === promise) {
                this.entries.delete(key);
            }
        });
        return promise;
    }

    invalidate(key: string): void {
        this.entries.delete(key);
    }

    private prune(now: number): void {
        for (const [key, entry] of this.entries) {
            if (entry.until <= now) this.entries.delete(key);
        }
    }
}
