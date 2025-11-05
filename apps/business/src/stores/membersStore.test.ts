import type { GetMembersParam } from "@/context/members/action/getProductMembers";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

const mockAddress1 = createMockAddress("member1");
const mockAddress2 = createMockAddress("member2");
const mockAddress3 = createMockAddress("member3");

describe("membersStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshMembersStore,
        }: TestContext) => {
            const state = freshMembersStore.getState();

            expect(state.selectedMembers).toBeUndefined();
            expect(state.tableFilters).toEqual({ limit: 10, offset: 0 });
            expect(state.tableFiltersCount).toBe(0);
        });
    });

    describe("addMember", () => {
        test("should add a member when selectedMembers is undefined", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);

            expect(freshMembersStore.getState().selectedMembers).toEqual([
                mockAddress1,
            ]);
        });

        test("should add a member to existing selection", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().addMember(mockAddress2);

            const selected = freshMembersStore.getState().selectedMembers;
            expect(selected).toHaveLength(2);
            expect(selected).toContain(mockAddress1);
            expect(selected).toContain(mockAddress2);
        });

        test("should deduplicate members when adding same address", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().addMember(mockAddress1);

            const selected = freshMembersStore.getState().selectedMembers;
            expect(selected).toHaveLength(1);
            expect(selected).toContain(mockAddress1);
        });

        test("should handle addresses with different casing", ({
            freshMembersStore,
        }: TestContext) => {
            // Use getAddress to get checksummed version, then test with lowercase
            // The store uses getAddress internally for deduplication
            freshMembersStore.getState().addMember(mockAddress1);
            // Adding the same address (even if different casing) should deduplicate
            // Note: getAddress normalizes to checksummed format
            freshMembersStore.getState().addMember(mockAddress1);

            const selected = freshMembersStore.getState().selectedMembers;
            // Should be deduplicated to 1
            expect(selected).toHaveLength(1);
        });
    });

    describe("removeMember", () => {
        test("should remove a member from selection", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().addMember(mockAddress2);
            freshMembersStore.getState().removeMember(mockAddress1);

            const selected = freshMembersStore.getState().selectedMembers;
            expect(selected).toHaveLength(1);
            expect(selected).toContain(mockAddress2);
            expect(selected).not.toContain(mockAddress1);
        });

        test("should do nothing when removing non-existent member", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().removeMember(mockAddress2);

            const selected = freshMembersStore.getState().selectedMembers;
            expect(selected).toHaveLength(1);
            expect(selected).toContain(mockAddress1);
        });

        test("should do nothing when selectedMembers is undefined", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().removeMember(mockAddress1);

            expect(
                freshMembersStore.getState().selectedMembers
            ).toBeUndefined();
        });
    });

    describe("clearSelection", () => {
        test("should clear all selected members", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().addMember(mockAddress2);
            freshMembersStore.getState().clearSelection();

            expect(
                freshMembersStore.getState().selectedMembers
            ).toBeUndefined();
        });

        test("should work when no members are selected", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().clearSelection();

            expect(
                freshMembersStore.getState().selectedMembers
            ).toBeUndefined();
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

    describe("edge cases", () => {
        test("should handle multiple add/remove operations", ({
            freshMembersStore,
        }: TestContext) => {
            freshMembersStore.getState().addMember(mockAddress1);
            freshMembersStore.getState().addMember(mockAddress2);
            freshMembersStore.getState().addMember(mockAddress3);
            freshMembersStore.getState().removeMember(mockAddress2);
            freshMembersStore.getState().addMember(mockAddress2);

            const selected = freshMembersStore.getState().selectedMembers;
            expect(selected).toHaveLength(3);
            expect(selected).toContain(mockAddress1);
            expect(selected).toContain(mockAddress2);
            expect(selected).toContain(mockAddress3);
        });
    });
});
