import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

describe("closeSplashscreen", () => {
    let splashElement: HTMLDivElement;

    beforeEach(() => {
        vi.useFakeTimers();

        // Create a splash overlay element that mirrors index.html
        splashElement = document.createElement("div");
        splashElement.id = "splash-overlay";
        splashElement.style.opacity = "1";
        document.body.appendChild(splashElement);

        // Reset the global timestamp
        window.__SPLASH_SHOWN_AT__ = undefined;
    });

    afterEach(() => {
        vi.useRealTimers();
        splashElement.remove();
    });

    test("should do nothing when splash-overlay is absent", async () => {
        splashElement.remove();

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        vi.runAllTimers();
        // No error thrown — graceful no-op
    });

    test("should wait for MIN_DISPLAY_MS before fading", async () => {
        window.__SPLASH_SHOWN_AT__ = Date.now();

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        // Before 2s, splash should still be visible
        vi.advanceTimersByTime(1999);
        expect(splashElement.style.opacity).toBe("1");

        // At 2s, fade starts
        vi.advanceTimersByTime(1);
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should skip delay when MIN_DISPLAY_MS already elapsed", async () => {
        // Splash was shown 3s ago
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        // Should fade immediately (delay = 0)
        vi.advanceTimersByTime(0);
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should remove element on transitionend", async () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        vi.advanceTimersByTime(0);

        // Simulate browser firing transitionend
        splashElement.dispatchEvent(new Event("transitionend"));

        expect(document.getElementById("splash-overlay")).toBeNull();
    });

    test("should remove element via fallback timeout when transitionend never fires", async () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        vi.advanceTimersByTime(0);
        expect(splashElement.style.opacity).toBe("0");

        // Don't fire transitionend — simulate reduced-motion or detached node
        // Fallback fires at TRANSITION_MS (300) + FALLBACK_BUFFER_MS (100) = 400ms
        vi.advanceTimersByTime(400);

        expect(document.getElementById("splash-overlay")).toBeNull();
    });

    test("should default to Date.now() when __SPLASH_SHOWN_AT__ is not set", async () => {
        // Don't set __SPLASH_SHOWN_AT__ — simulates non-Tauri or late init
        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        // elapsed ≈ 0, so delay should be full MIN_DISPLAY_MS
        vi.advanceTimersByTime(1999);
        expect(splashElement.style.opacity).toBe("1");

        vi.advanceTimersByTime(1);
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should handle double-remove gracefully", async () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;

        const { closeSplashscreen } = await import("./splashscreen");
        closeSplashscreen();

        vi.advanceTimersByTime(0);

        // Both transitionend and fallback fire — second remove is a no-op
        splashElement.dispatchEvent(new Event("transitionend"));
        expect(document.getElementById("splash-overlay")).toBeNull();

        // Fallback timeout fires — should not throw
        vi.advanceTimersByTime(400);
    });
});
