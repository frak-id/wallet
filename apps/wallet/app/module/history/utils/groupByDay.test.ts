import { groupByDay } from "@/module/history/utils/groupByDay";
import { describe, expect, test } from "@/tests/vitest-fixtures";

const defaultOptions = {
    locale: "en",
    todayLabel: "Today",
    yesterdayLabel: "Yesterday",
};

describe("groupByDay", () => {
    test("should group items by day", () => {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

        const items = [
            { timestamp: Math.floor(now / 1000), id: 1 },
            { timestamp: Math.floor(now / 1000) - 3600, id: 2 },
            { timestamp: Math.floor(oneDayAgo / 1000), id: 3 },
            { timestamp: Math.floor(twoDaysAgo / 1000), id: 4 },
        ];

        const result = groupByDay(items, defaultOptions);

        const keys = Object.keys(result);
        expect(keys.length).toBeGreaterThan(0);
        expect(result.Today).toBeDefined();
        expect(result.Today).toHaveLength(2);
    });

    test("should sort items by timestamp descending", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now - 1000, id: 1 },
            { timestamp: now, id: 2 },
            { timestamp: now - 500, id: 3 },
        ];

        const result = groupByDay(items, defaultOptions);

        const todayItems = result.Today || [];
        expect(todayItems[0].id).toBe(2);
        expect(todayItems[1].id).toBe(3);
        expect(todayItems[2].id).toBe(1);
    });

    test("should handle empty array", () => {
        const items: { timestamp: number; id: number }[] = [];

        const result = groupByDay(items, defaultOptions);

        expect(result).toEqual({});
    });

    test("should handle single item", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [{ timestamp: now, id: 1 }];

        const result = groupByDay(items, defaultOptions);

        expect(result.Today).toBeDefined();
        expect(result.Today).toHaveLength(1);
        expect(result.Today[0].id).toBe(1);
    });

    test("should group Yesterday items", () => {
        const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const items = [
            { timestamp: yesterday, id: 1 },
            { timestamp: yesterday - 3600, id: 2 },
        ];

        const result = groupByDay(items, defaultOptions);

        expect(result.Yesterday).toBeDefined();
        expect(result.Yesterday).toHaveLength(2);
    });

    test("should use localized date for older items", () => {
        const threeDaysAgo = Math.floor(
            (Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000
        );
        const items = [{ timestamp: threeDaysAgo, id: 1 }];

        const result = groupByDay(items, defaultOptions);

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(keys[0]).not.toBe("Today");
        expect(keys[0]).not.toBe("Yesterday");
    });

    test("should use locale-specific date format", () => {
        const threeDaysAgo = Math.floor(
            (Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000
        );
        const items = [{ timestamp: threeDaysAgo, id: 1 }];

        const resultFr = groupByDay(items, {
            ...defaultOptions,
            locale: "fr",
        });
        const resultEn = groupByDay(items, {
            ...defaultOptions,
            locale: "en",
        });

        const frKey = Object.keys(resultFr)[0];
        const enKey = Object.keys(resultEn)[0];
        // French uses "day month" format (e.g., "5 avril")
        // English uses "month day" format (e.g., "April 5")
        expect(frKey).not.toBe(enKey);
    });

    test("should use custom today/yesterday labels", () => {
        const now = Math.floor(Date.now() / 1000);
        const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const items = [
            { timestamp: now, id: 1 },
            { timestamp: yesterday, id: 2 },
        ];

        const result = groupByDay(items, {
            locale: "fr",
            todayLabel: "Aujourd'hui",
            yesterdayLabel: "Hier",
        });

        expect(result["Aujourd'hui"]).toBeDefined();
        expect(result.Hier).toBeDefined();
    });

    test("should preserve item data in grouped results", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now, id: 1, name: "Item 1" },
            { timestamp: now - 3600, id: 2, name: "Item 2" },
        ];

        const result = groupByDay(items, defaultOptions);

        expect(result.Today[0]).toEqual(items[0]);
        expect(result.Today[1]).toEqual(items[1]);
    });

    test("should handle items spanning multiple days", () => {
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

        const result = groupByDay(items, defaultOptions);

        const keys = Object.keys(result);
        expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    test("should handle items with same timestamp", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [
            { timestamp: now, id: 1 },
            { timestamp: now, id: 2 },
            { timestamp: now, id: 3 },
        ];

        const result = groupByDay(items, defaultOptions);

        expect(result.Today).toHaveLength(3);
    });

    test("should handle very old timestamps", () => {
        const oldTimestamp = Math.floor(
            new Date("2020-01-01").getTime() / 1000
        );
        const items = [{ timestamp: oldTimestamp, id: 1 }];

        const result = groupByDay(items, defaultOptions);

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(result[keys[0]]).toHaveLength(1);
    });

    test("should return record object with string keys", () => {
        const now = Math.floor(Date.now() / 1000);
        const items = [{ timestamp: now, id: 1 }];

        const result = groupByDay(items, defaultOptions);

        expect(typeof result).toBe("object");
        expect(Array.isArray(result)).toBe(false);
    });
});
