/**
 * Map with a LRU (Least Recently Used) eviction policy.
 *
 * When the map exceeds `maxSize`, the least recently accessed entry is removed.
 * Accessing a key via `get()` promotes it to "most recently used".
 *
 * Adapted from viem's LruMap utility.
 * @link https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
 */
export class LruMap<TValue = unknown> extends Map<string, TValue> {
    maxSize: number;

    constructor(size: number) {
        super();
        this.maxSize = size;
    }

    override get(key: string) {
        const value = super.get(key);
        if (super.has(key)) {
            // Move to end (most recently used)
            super.delete(key);
            super.set(key, value as TValue);
        }
        return value;
    }

    override set(key: string, value: TValue) {
        if (super.has(key)) super.delete(key);
        super.set(key, value);
        // Evict least recently used if over capacity
        if (this.maxSize && this.size > this.maxSize) {
            const firstKey = super.keys().next().value;
            if (firstKey !== undefined) super.delete(firstKey);
        }
        return this;
    }
}
