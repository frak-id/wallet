import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    hideBootSplash,
    setBootSplashStatus,
    showBootSplash,
} from "./bootSplash";

function splash() {
    const element = document.getElementById("boot-splash");
    if (!element) throw new Error("boot splash missing");
    return element;
}

describe("boot splash", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <div id="boot-splash">
                <div class="boot-splash-status"><p class="boot-splash-text"></p></div>
            </div>`;
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it("fades out, then hides and clears its status", () => {
        setBootSplashStatus("Downloading");

        hideBootSplash();
        expect(splash().hasAttribute("data-leaving")).toBe(true);
        expect(splash().hidden).toBe(false);

        vi.advanceTimersByTime(200);
        expect(splash().hidden).toBe(true);
        expect(splash().textContent?.trim()).toBe("");
    });

    it("comes back over a fade that has not finished", () => {
        hideBootSplash();
        showBootSplash();

        vi.advanceTimersByTime(200);
        expect(splash().hidden).toBe(false);
        expect(splash().hasAttribute("data-leaving")).toBe(false);
    });

    it("does nothing when the page has no splash", () => {
        document.body.innerHTML = "";

        expect(() => {
            setBootSplashStatus("x");
            hideBootSplash();
            showBootSplash();
        }).not.toThrow();
    });
});
