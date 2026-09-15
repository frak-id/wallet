/** @jsxImportSource react */
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mockUseBlocker = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
    useBlocker: mockUseBlocker,
}));

import { useHardwareBack } from "./useHardwareBack";

type ShouldBlockFn = (args: { action: string }) => boolean;

/**
 * The blocker is what turns an iOS edge-swipe (and browser back) into a modal
 * pop, so these assert `shouldBlockFn` directly rather than the gesture.
 */
function renderBlocker() {
    renderHook(() => useHardwareBack());
    const call = mockUseBlocker.mock.calls.at(-1)?.[0];
    if (!call) throw new Error("useBlocker was never called");
    return call;
}

/** `shouldBlockFn` mutates the modal store, so it runs inside `act`. */
function fire(shouldBlockFn: ShouldBlockFn, action: string) {
    let blocked = false;
    act(() => {
        blocked = shouldBlockFn({ action });
    });
    return blocked;
}

describe("useHardwareBack", () => {
    beforeEach(() => {
        modalStore.getState().dismissAll();
        vi.clearAllMocks();
    });

    test("stays disabled while no modal is open", () => {
        expect(renderBlocker().disabled).toBe(true);
    });

    test("activates once a modal opens", () => {
        modalStore.getState().openModal({ id: "transfer" });
        expect(renderBlocker().disabled).toBe(false);
    });

    test("BACK pops the modal and blocks the navigation", () => {
        modalStore.getState().openModal({ id: "transfer" });
        const { shouldBlockFn } = renderBlocker();

        expect(fire(shouldBlockFn, "BACK")).toBe(true);
        expect(modalStore.getState().modal).toBeNull();
    });

    test("BACK unwinds one modal at a time", () => {
        modalStore.getState().openModal({ id: "transfer" });
        modalStore.getState().openModal({ id: "emptyPendingGains" });
        const { shouldBlockFn } = renderBlocker();

        expect(fire(shouldBlockFn, "BACK")).toBe(true);
        expect(modalStore.getState().modal?.id).toBe("transfer");

        expect(fire(shouldBlockFn, "BACK")).toBe(true);
        expect(modalStore.getState().modal).toBeNull();
    });

    test("BACK with no modal open lets the route pop through", () => {
        const { shouldBlockFn } = renderBlocker();
        expect(fire(shouldBlockFn, "BACK")).toBe(false);
    });

    test("PUSH clears the overlay without blocking", () => {
        modalStore.getState().openModal({ id: "transfer" });
        const { shouldBlockFn } = renderBlocker();

        expect(fire(shouldBlockFn, "PUSH")).toBe(false);
        expect(modalStore.getState().modal).toBeNull();
    });
});
