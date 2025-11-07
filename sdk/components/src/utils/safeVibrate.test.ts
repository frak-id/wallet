import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeVibrate } from "./safeVibrate";

describe("safeVibrate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore navigator if it was modified
        if (!("vibrate" in navigator)) {
            (navigator as any).vibrate = undefined;
        }
    });

    it("should vibrate when navigator.vibrate is available", () => {
        const vibrateSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateSpy,
            writable: true,
            configurable: true,
        });

        safeVibrate();

        expect(vibrateSpy).toHaveBeenCalledWith(10);
    });

    it("should not throw error when vibrate is not available", () => {
        const originalVibrate = (navigator as any).vibrate;
        delete (navigator as any).vibrate;

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        expect(() => safeVibrate()).not.toThrow();
        expect(consoleLogSpy).toHaveBeenCalledWith("Vibration not supported");

        // Restore
        (navigator as any).vibrate = originalVibrate;
        consoleLogSpy.mockRestore();
    });
});
