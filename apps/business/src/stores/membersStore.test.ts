import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

describe("membersStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshMembersStore,
        }: TestContext) => {
            const state = freshMembersStore.getState();

            expect(state.tableFilters).toEqual({ limit: 10, offset: 0 });
            expect(state.tableFiltersCount).toBe(0);
        });
    });

    describe("setTableFilters", () => {
        test("should set table filters directly", ({
            freshMembersStore,
        }: TestContext) => {
            const filters = { limit: 20, offset: 10 };
            freshMembersStore.getState().setTableFilters(filters);

            expect(freshMembersStore.getState().tableFilters).toEqual(filters);
        });

        test("should set table filters with function updater", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore
                .getState()
                .setTableFilters((prev: GetMembersParam) => ({
                    ...prev,
                    limit: 50,
                }));

            expect(freshMembersStore.getState().tableFilters).toEqual({
                limit: 50,
                offset: 0,
            });
        });

        test("should update filters multiple times", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore
                .getState()
                .setTableFilters({ limit: 20, offset: 0 });
            freshMembersStore
                .getState()
                .setTableFilters({ limit: 30, offset: 10 });

            expect(freshMembersStore.getState().tableFilters).toEqual({
                limit: 30,
                offset: 10,
            });
        });
    });

    describe("setTableFiltersCount", () => {
        test("should set filter count", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().setTableFiltersCount(5);

            expect(freshMembersStore.getState().tableFiltersCount).toBe(5);
        });

        test("should update filter count", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().setTableFiltersCount(3);
            freshMembersStore.getState().setTableFiltersCount(7);

            expect(freshMembersStore.getState().tableFiltersCount).toBe(7);
        });

        test("should handle zero count", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().setTableFiltersCount(5);
            freshMembersStore.getState().setTableFiltersCount(0);

            expect(freshMembersStore.getState().tableFiltersCount).toBe(0);
        });
    });
});
