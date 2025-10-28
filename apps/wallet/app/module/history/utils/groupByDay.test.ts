import { describe, expect, it } from "vitest";
import { groupByDay } from "@/module/history/utils/groupByDay";

describe("groupByDay", () => {
    it("should group items by day", () => {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

        const items = [
            { timestamp: Math.floor(now / 1000), id: 1 },
            { timestamp: Math.floor(now / 1000) - 3600, id: 2 }, // 1 hour ago
            { timestamp: Math.floor(oneDayAgo / 1000), id: 3 },
            { timestamp: Math.floor(twoDaysAgo / 1000), id: 4 },
        ];

        const result = groupByDay(items);

        const keys = Object.keys(result);
        expect(keys.length).toBeGreaterThan(0);
        expect(result.Today).toBeDefined();
        expect(result.Today).toHaveLength(2);
    });

    it("should sort items by timestamp descending", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now - 1000, id: 1 },
            { timestamp: now, id: 2 },
            { timestamp: now - 500, id: 3 },
        ];

        const result = groupByDay(items);

        const todayItems = result.Today || [];
        expect(todayItems[0].id).toBe(2); // Most recent first
        expect(todayItems[1].id).toBe(3);
        expect(todayItems[2].id).toBe(1);
    });

    it("should handle empty array", () => {
        const items: { timestamp: number; id: number }[] = [];

        const result = groupByDay(items);

        expect(result).toEqual({});
    });

    it("should handle single item", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [{ timestamp: now, id: 1 }];

        const result = groupByDay(items);

        expect(result.Today).toBeDefined();
        expect(result.Today).toHaveLength(1);
        expect(result.Today[0].id).toBe(1);
    });

    it("should group Yesterday items", () => {
        const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const items = [
            { timestamp: yesterday, id: 1 },
            { timestamp: yesterday - 3600, id: 2 },
        ];

        const result = groupByDay(items);

        expect(result.Yesterday).toBeDefined();
        expect(result.Yesterday).toHaveLength(2);
    });

    it("should group older items by date", () => {
        const threeDaysAgo = Math.floor(
            (Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000
        );
        const items = [{ timestamp: threeDaysAgo, id: 1 }];

        const result = groupByDay(items);

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(keys[0]).not.toBe("Today");
        expect(keys[0]).not.toBe("Yesterday");
    });

    it("should preserve item data in grouped results", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now, id: 1, name: "Item 1" },
            { timestamp: now - 3600, id: 2, name: "Item 2" },
        ];

        const result = groupByDay(items);

        expect(result.Today[0]).toEqual(items[0]);
        expect(result.Today[1]).toEqual(items[1]);
    });

    it("should handle items spanning multiple days", () => {
        const now = Math.floor(Date.now() / 1000);
        const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const twoDaysAgo = Math.floor(
            (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000
        );

        const items = [
            { timestamp: now, id: 1 },
            { timestamp: yesterday, id: 2 },
            { timestamp: twoDaysAgo, id: 3 },
        ];

        const result = groupByDay(items);

        const keys = Object.keys(result);
        expect(keys.length).toBeGreaterThanOrEqual(2); // At least Today and Yesterday
    });

    it("should handle items with same timestamp", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now, id: 1 },
            { timestamp: now, id: 2 },
            { timestamp: now, id: 3 },
        ];

        const result = groupByDay(items);

        expect(result.Today).toHaveLength(3);
    });

    it("should handle very old timestamps", () => {
        const oldTimestamp = Math.floor(
            new Date("2020-01-01").getTime() / 1000
        );
        const items = [{ timestamp: oldTimestamp, id: 1 }];

        const result = groupByDay(items);

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(result[keys[0]]).toHaveLength(1);
    });

    it("should return record object with string keys", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [{ timestamp: now, id: 1 }];

        const result = groupByDay(items);

        expect(typeof result).toBe("object");
        expect(Array.isArray(result)).toBe(false);
    });
});
