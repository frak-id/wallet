import { describe, expect, test } from "vitest";
import { filterPushHistory } from "./filterPushHistory";
import type { PushHistoryItem } from "./types";

function item(overrides: Partial<PushHistoryItem>): PushHistoryItem {
    return {
        id: "id",
        title: "Title",
        status: "scheduled",
        scheduledAt: new Date("2026-06-15T10:00:00Z").getTime(),
        audienceLabel: "All members",
        sent: null,
        opened: null,
        payload: { title: "Title", body: "Body" },
        target: { filter: {} },
        targetCount: 100,
        ...overrides,
    };
}

const scheduled = item({ id: "a", status: "scheduled" });
const sent = item({
    id: "b",
    status: "sent",
    scheduledAt: new Date("2026-06-20T10:00:00Z").getTime(),
});
const items = [scheduled, sent];

describe("filterPushHistory", () => {
    test("returns everything when no filters are set", () => {
        expect(filterPushHistory(items, {})).toEqual(items);
    });

    test("filters by a single status", () => {
        expect(filterPushHistory(items, { status: ["sent"] })).toEqual([sent]);
    });

    test("keeps all statuses when the status list is empty", () => {
        expect(filterPushHistory(items, { status: [] })).toEqual(items);
    });

    test("matches multiple statuses", () => {
        expect(
            filterPushHistory(items, { status: ["scheduled", "sent"] })
        ).toEqual(items);
    });

    test("excludes items before the date-range start (inclusive day)", () => {
        const from = new Date("2026-06-18T00:00:00Z");
        expect(filterPushHistory(items, { dateRange: { from } })).toEqual([
            sent,
        ]);
    });

    test("excludes items after the date-range end (inclusive day)", () => {
        const to = new Date("2026-06-18T00:00:00Z");
        expect(
            filterPushHistory(items, { dateRange: { from: undefined, to } })
        ).toEqual([scheduled]);
    });

    test("combines status and date-range filters", () => {
        const from = new Date("2026-06-18T00:00:00Z");
        expect(
            filterPushHistory(items, {
                status: ["scheduled"],
                dateRange: { from },
            })
        ).toEqual([]);
    });
});
