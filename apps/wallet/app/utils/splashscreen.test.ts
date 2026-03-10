import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeSplashscreen } from "./splashscreen";

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

    test("should do nothing when splash-overlay is absent", () => {
        splashElement.remove();
        closeSplashscreen();
        vi.runAllTimers();
        // No error thrown — graceful no-op
    });

    test("should wait for MIN_DISPLAY_MS before fading", () => {
        window.__SPLASH_SHOWN_AT__ = Date.now();
        closeSplashscreen();

        // Before 2s, splash should still be visible
        vi.advanceTimersByTime(1999);
        expect(splashElement.style.opacity).toBe("1");

        // At 2s, fade starts
        vi.advanceTimersByTime(1);
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should skip delay when MIN_DISPLAY_MS already elapsed", () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;
        closeSplashscreen();

        vi.runAllTimers();
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should remove element on transitionend", () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;
        closeSplashscreen();
        vi.runAllTimers();

        splashElement.dispatchEvent(new Event("transitionend"));
        expect(document.getElementById("splash-overlay")).toBeNull();
    });

    test("should remove element via fallback timeout when transitionend never fires", () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;
        closeSplashscreen();

        // Fade starts immediately (delay=0) after first timer tick
        vi.advanceTimersByTime(0);
        expect(splashElement.style.opacity).toBe("0");

        // Fallback removes after 350ms even without transitionend
        vi.advanceTimersByTime(400);

        expect(document.getElementById("splash-overlay")).toBeNull();
    });

    test("should default to Date.now() when __SPLASH_SHOWN_AT__ is not set", () => {
        closeSplashscreen();

        vi.advanceTimersByTime(1999);
        expect(splashElement.style.opacity).toBe("1");

        vi.advanceTimersByTime(1);
        expect(splashElement.style.opacity).toBe("0");
    });

    test("should handle double-remove gracefully", () => {
        window.__SPLASH_SHOWN_AT__ = Date.now() - 3000;
        closeSplashscreen();
        vi.runAllTimers();

        // Both transitionend and fallback fire — no error
        splashElement.dispatchEvent(new Event("transitionend"));
        expect(document.getElementById("splash-overlay")).toBeNull();
    });
});
