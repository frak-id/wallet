import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

describe("pushHistoryStore", () => {
    describe("initial state", () => {
        test("starts with no filters", ({
            freshPushHistoryStore,
        }: TestContext) => {
            expect(freshPushHistoryStore.getState().filters).toEqual({});
        });
    });

    describe("setFilters", () => {
        test("replaces filters when given an object", ({
            freshPushHistoryStore,
        }: TestContext) => {
            freshPushHistoryStore.getState().setFilters({ status: ["sent"] });

            expect(freshPushHistoryStore.getState().filters).toEqual({
                status: ["sent"],
            });
        });

        test("merges via a functional updater", ({
            freshPushHistoryStore,
        }: TestContext) => {
            const from = new Date("2026-06-18");
            freshPushHistoryStore.getState().setFilters({ status: ["sent"] });
            freshPushHistoryStore
                .getState()
                .setFilters((prev) => ({ ...prev, dateRange: { from } }));

            expect(freshPushHistoryStore.getState().filters).toEqual({
                status: ["sent"],
                dateRange: { from },
            });
        });
    });
});
