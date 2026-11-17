import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useCopyToClipboardWithState } from "./useCopyToClipboardWithState";

describe("useCopyToClipboardWithState", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.useFakeTimers();
        writeText.mockClear();
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("is copied for two seconds after a copy", () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        act(() => result.current.copy("LOLA10"));
        expect(writeText).toHaveBeenCalledWith("LOLA10");
        expect(result.current.copied).toBe(true);

        act(() => vi.advanceTimersByTime(2000));
        expect(result.current.copied).toBe(false);
    });

    test("a second copy inside that window still reaches the clipboard", () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        act(() => result.current.copy("https://wallet.frak.id/r/LOLA10"));
        act(() => vi.advanceTimersByTime(500));
        act(() => result.current.copy("LOLA10"));

        expect(writeText).toHaveBeenLastCalledWith("LOLA10");
        expect(writeText).toHaveBeenCalledTimes(2);
    });

    test("a second copy restarts the window", () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        act(() => result.current.copy("A"));
        act(() => vi.advanceTimersByTime(1500));
        act(() => result.current.copy("B"));
        act(() => vi.advanceTimersByTime(1500));

        expect(result.current.copied).toBe(true);
    });
});
