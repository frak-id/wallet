import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { LruMap } from "./lruMap";

describe("LruMap", () => {
    it("should store and retrieve values", () => {
        const map = new LruMap<number>(3);
        map.set("a", 1);
        map.set("b", 2);

        expect(map.get("a")).toBe(1);
        expect(map.get("b")).toBe(2);
    });

    it("should evict least recently used when exceeding max size", () => {
        const map = new LruMap<number>(2);
        map.set("a", 1);
        map.set("b", 2);
        map.set("c", 3); // Should evict "a"

        expect(map.get("a")).toBeUndefined();
        expect(map.get("b")).toBe(2);
        expect(map.get("c")).toBe(3);
    });

    it("should promote accessed keys to most recently used", () => {
        const map = new LruMap<number>(2);
        map.set("a", 1);
        map.set("b", 2);

        // Access "a" to promote it
        map.get("a");

        // "b" is now least recently used, should be evicted
        map.set("c", 3);

        expect(map.get("a")).toBe(1);
        expect(map.get("b")).toBeUndefined();
        expect(map.get("c")).toBe(3);
    });

    it("should overwrite existing keys without increasing size", () => {
        const map = new LruMap<number>(2);
        map.set("a", 1);
        map.set("b", 2);
        map.set("a", 10); // Overwrite, not a new entry

        expect(map.size).toBe(2);
        expect(map.get("a")).toBe(10);
    });

    it("should return undefined for missing keys", () => {
        const map = new LruMap<number>(2);
        expect(map.get("missing")).toBeUndefined();
    });
});
