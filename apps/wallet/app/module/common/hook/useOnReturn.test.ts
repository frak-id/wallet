import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnReturn } from "./useOnReturn";

function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("useOnReturn", () => {
    afterEach(() => setVisibility("visible"));

    it("runs once when the page is visible again after arming", () => {
        const onReturn = vi.fn();
        const { result } = renderHook(() => useOnReturn(onReturn));

        act(() => result.current());
        setVisibility("hidden");
        expect(onReturn).not.toHaveBeenCalled();

        setVisibility("visible");
        setVisibility("hidden");
        setVisibility("visible");
        expect(onReturn).toHaveBeenCalledTimes(1);
    });

    it("ignores visibility changes until armed", () => {
        const onReturn = vi.fn();
        renderHook(() => useOnReturn(onReturn));

        setVisibility("hidden");
        setVisibility("visible");

        expect(onReturn).not.toHaveBeenCalled();
    });

    it("calls the latest callback", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { result, rerender } = renderHook(
            ({ callback }) => useOnReturn(callback),
            { initialProps: { callback: first } }
        );

        act(() => result.current());
        rerender({ callback: second });
        setVisibility("visible");

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
