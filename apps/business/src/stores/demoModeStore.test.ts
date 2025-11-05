import { QueryClient } from "@tanstack/react-query";
import {
    describe,
    expect,
    type TestContext,
    test,
    vi,
} from "@/tests/vitest-fixtures";

describe("demoModeStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshDemoModeStore,
        }: TestContext) => {
            const state = freshDemoModeStore.getState();

            expect(state.isDemoMode).toBe(false);
        });
    });

    describe("setDemoMode", () => {
        test("should update demo mode state", ({
            freshDemoModeStore,
        }: TestContext) => {
            freshDemoModeStore.getState().setDemoMode(true);

            expect(freshDemoModeStore.getState().isDemoMode).toBe(true);
        });

        test("should sync to cookies", ({
            freshDemoModeStore,
        }: TestContext) => {
            freshDemoModeStore.getState().setDemoMode(true);

            // Check cookie was set
            expect(document.cookie).toContain("business_demoMode=true");
        });

        test("should update cookie when toggling demo mode", ({
            freshDemoModeStore,
        }: TestContext) => {
            freshDemoModeStore.getState().setDemoMode(true);
            expect(document.cookie).toContain("business_demoMode=true");

            freshDemoModeStore.getState().setDemoMode(false);
            expect(document.cookie).toContain("business_demoMode=false");
        });

        test("should persist demo mode state", ({
            freshDemoModeStore,
        }: TestContext) => {
            freshDemoModeStore.getState().setDemoMode(true);

            // Check localStorage
            const stored = localStorage.getItem("business_demoMode");
            expect(stored).toBeTruthy();
        });

        test("should invalidate queries when demo mode changes", ({
            freshDemoModeStore,
        }: TestContext) => {
            const queryClient = new QueryClient();
            const invalidateQueriesSpy = vi.spyOn(
                queryClient,
                "invalidateQueries"
            );

            // Set initial demo mode
            freshDemoModeStore.getState().setDemoMode(false);

            // Change demo mode with queryClient
            freshDemoModeStore.getState().setDemoMode(true, queryClient);

            expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
        });

        test("should not invalidate queries when demo mode doesn't change", ({
            freshDemoModeStore,
        }: TestContext) => {
            const queryClient = new QueryClient();
            const invalidateQueriesSpy = vi.spyOn(
                queryClient,
                "invalidateQueries"
            );

            // Set demo mode
            freshDemoModeStore.getState().setDemoMode(true, queryClient);

            // Set same demo mode again
            freshDemoModeStore.getState().setDemoMode(true, queryClient);

            // Should only invalidate once (on the first change)
            expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
        });

        test("should work without queryClient", ({
            freshDemoModeStore,
        }: TestContext) => {
            // Should not throw when queryClient is undefined
            expect(() => {
                freshDemoModeStore.getState().setDemoMode(true);
            }).not.toThrow();
        });

        test("should handle rapid toggles", ({
            freshDemoModeStore,
        }: TestContext) => {
            const queryClient = new QueryClient();
            const invalidateQueriesSpy = vi.spyOn(
                queryClient,
                "invalidateQueries"
            );

            // Start from false (initial state), so first toggle to true is a change
            freshDemoModeStore.getState().setDemoMode(true, queryClient);
            freshDemoModeStore.getState().setDemoMode(false, queryClient);
            freshDemoModeStore.getState().setDemoMode(true, queryClient);

            // Should invalidate on each change: false->true (1), true->false (2), false->true (3)
            expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
        });
    });
});
