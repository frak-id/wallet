import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearBootSplashStatus,
    hideBootSplash,
    setBootSplashStatus,
} from "./bootSplash";

function splash() {
    const element = document.getElementById("boot-splash");
    if (!element) throw new Error("boot splash missing");
    return element;
}

function status() {
    const element = document.querySelector(".boot-splash-status");
    if (!element) throw new Error("status missing");
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

    it("keeps the text while the status fades out", () => {
        setBootSplashStatus("Downloading");
        setBootSplashStatus(null);

        expect(status().hasAttribute("data-visible")).toBe(false);
        expect(status().textContent).toBe("Downloading");
    });

    it("resolves the status fade only once it is over", async () => {
        setBootSplashStatus("Downloading");
        let done = false;
        void clearBootSplashStatus().then(() => {
            done = true;
        });

        await vi.advanceTimersByTimeAsync(249);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(done).toBe(true);
    });

    it("does not wait to clear a status nobody saw", async () => {
        await expect(clearBootSplashStatus()).resolves.toBeUndefined();
    });

    it("plays the exit, then hides and clears its status", () => {
        setBootSplashStatus("Downloading");

        hideBootSplash();
        expect(splash().hasAttribute("data-leaving")).toBe(true);
        vi.advanceTimersByTime(249);
        expect(splash().hidden).toBe(false);

        vi.advanceTimersByTime(1);
        expect(splash().hidden).toBe(true);
        expect(splash().hasAttribute("data-leaving")).toBe(false);
        expect(status().textContent).toBe("");
    });

    it("does nothing when the page has no splash", async () => {
        document.body.innerHTML = "";

        setBootSplashStatus("x");
        hideBootSplash();
        await expect(clearBootSplashStatus()).resolves.toBeUndefined();
    });
});
