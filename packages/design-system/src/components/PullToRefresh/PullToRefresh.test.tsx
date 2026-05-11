import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./index";

// Helper: create a minimal TouchEvent-like object that jsdom will accept.
function makeTouchEvent(type: string, clientY: number): Event {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
        touches: [{ clientY }],
        changedTouches: [{ clientY }],
    });
    return e;
}

describe("PullToRefresh", () => {
    describe("non-touch environment (jsdom default)", () => {
        it("renders children as a transparent passthrough", () => {
            const ref = createRef<HTMLDivElement>();
            render(
                <PullToRefresh onRefresh={vi.fn()} scrollContainerRef={ref}>
                    <span>hello world</span>
                </PullToRefresh>
            );
            expect(screen.getByText("hello world")).toBeInTheDocument();
        });

        it("does not mount pull indicators", () => {
            const ref = createRef<HTMLDivElement>();
            render(
                <PullToRefresh onRefresh={vi.fn()} scrollContainerRef={ref}>
                    <span>child</span>
                </PullToRefresh>
            );
            // In non-touch mode the component renders just <>{children}</>,
            // so there should be no wrapper div with the root class
            const child = screen.getByText("child");
            expect(child.closest("[aria-hidden]")).toBeNull();
        });

        it("renders passthrough on Chromium desktops that stub ontouchstart without real touch hardware", () => {
            // Some Chromium desktop builds expose `ontouchstart` even though
            // there's no touchscreen. The component must additionally check
            // `navigator.maxTouchPoints` so these false positives are
            // treated as non-touch.
            Object.defineProperty(window, "ontouchstart", {
                value: null,
                configurable: true,
                writable: true,
            });
            // navigator.maxTouchPoints defaults to 0 in jsdom — make it
            // explicit for clarity.
            Object.defineProperty(navigator, "maxTouchPoints", {
                value: 0,
                configurable: true,
                writable: true,
            });

            const ref = createRef<HTMLDivElement>();
            render(
                <PullToRefresh onRefresh={vi.fn()} scrollContainerRef={ref}>
                    <span>chrome stub</span>
                </PullToRefresh>
            );

            const child = screen.getByText("chrome stub");
            expect(child.closest("[aria-hidden]")).toBeNull();

            delete (window as unknown as Record<string, unknown>).ontouchstart;
        });
    });

    describe("touch environment (mocked)", () => {
        let container: HTMLDivElement;
        let scrollRef: React.RefObject<HTMLDivElement>;

        beforeEach(() => {
            // Simulate a touch device: Chrome stubs `ontouchstart` even on
            // some non-touch desktops, so the component also requires
            // `navigator.maxTouchPoints > 0`. Mock both.
            Object.defineProperty(window, "ontouchstart", {
                value: null,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(navigator, "maxTouchPoints", {
                value: 5,
                configurable: true,
                writable: true,
            });

            // Create a real DOM node to act as the scroll container
            container = document.createElement("div");
            Object.defineProperty(container, "scrollTop", {
                value: 0,
                configurable: true,
                writable: true,
            });
            document.body.appendChild(container);

            // Point the ref at this container
            scrollRef = {
                current: container,
            } as React.RefObject<HTMLDivElement>;
        });

        afterEach(() => {
            // RTL's auto-cleanup may have already detached the node, so use
            // the defensive .remove() (no-op if already detached).
            container.remove();
            // Reset ontouchstart (configurable: true makes delete legal here)
            delete (window as unknown as Record<string, unknown>).ontouchstart;
            Object.defineProperty(navigator, "maxTouchPoints", {
                value: 0,
                configurable: true,
                writable: true,
            });
        });

        it("calls onRefresh when pull exceeds threshold", async () => {
            const onRefresh = vi.fn().mockResolvedValue(undefined);

            render(
                <PullToRefresh
                    onRefresh={onRefresh}
                    scrollContainerRef={scrollRef}
                    threshold={70}
                    resistance={1}
                >
                    <span>content</span>
                </PullToRefresh>
            );

            container.dispatchEvent(makeTouchEvent("touchstart", 200));
            container.dispatchEvent(makeTouchEvent("touchmove", 300)); // dy=100, resistance=1 → damped=100, above threshold 70
            container.dispatchEvent(makeTouchEvent("touchend", 300));

            await waitFor(() => {
                expect(onRefresh).toHaveBeenCalledOnce();
            });
        });

        it("does NOT call onRefresh when pull is below threshold", async () => {
            const onRefresh = vi.fn().mockResolvedValue(undefined);

            render(
                <PullToRefresh
                    onRefresh={onRefresh}
                    scrollContainerRef={scrollRef}
                    threshold={70}
                    resistance={1}
                >
                    <span>content</span>
                </PullToRefresh>
            );

            container.dispatchEvent(makeTouchEvent("touchstart", 200));
            container.dispatchEvent(makeTouchEvent("touchmove", 220)); // dy=20, below threshold 70
            container.dispatchEvent(makeTouchEvent("touchend", 220));

            // Give async effects a chance to run
            await new Promise((r) => setTimeout(r, 50));
            expect(onRefresh).not.toHaveBeenCalled();
        });

        it("does NOT arm pull when scrollTop > 0", async () => {
            const onRefresh = vi.fn().mockResolvedValue(undefined);

            // Simulate a page scrolled down
            Object.defineProperty(container, "scrollTop", {
                value: 50,
                configurable: true,
                writable: true,
            });

            render(
                <PullToRefresh
                    onRefresh={onRefresh}
                    scrollContainerRef={scrollRef}
                    threshold={70}
                    resistance={1}
                >
                    <span>content</span>
                </PullToRefresh>
            );

            container.dispatchEvent(makeTouchEvent("touchstart", 200));
            container.dispatchEvent(makeTouchEvent("touchmove", 400)); // large dy but scrollTop > 0
            container.dispatchEvent(makeTouchEvent("touchend", 400));

            await new Promise((r) => setTimeout(r, 50));
            expect(onRefresh).not.toHaveBeenCalled();
        });

        it("does NOT trigger refresh when scrollTop reaches 0 mid-gesture (no stale startY)", async () => {
            const onRefresh = vi.fn().mockResolvedValue(undefined);

            // Finger lands while the container is scrolled down.
            Object.defineProperty(container, "scrollTop", {
                value: 500,
                configurable: true,
                writable: true,
            });

            render(
                <PullToRefresh
                    onRefresh={onRefresh}
                    scrollContainerRef={scrollRef}
                    threshold={70}
                    resistance={1}
                >
                    <span>content</span>
                </PullToRefresh>
            );

            // Finger lands at Y=100 while scrolled. Simulate scrolling: a
            // burst of touchmoves while scrollTop > 0 (real hardware fires
            // dozens of these per gesture). Each one should keep startY in
            // sync with the finger.
            container.dispatchEvent(makeTouchEvent("touchstart", 100));
            container.dispatchEvent(makeTouchEvent("touchmove", 150));
            container.dispatchEvent(makeTouchEvent("touchmove", 180));

            // Container reaches the top. Finger continues just 20px further.
            // Without the fix, dy would be (200 - 100) = 100 — above
            // threshold. With the fix, startY tracks the last guarded
            // touchmove (Y=180), so dy is only 20.
            Object.defineProperty(container, "scrollTop", {
                value: 0,
                configurable: true,
                writable: true,
            });
            container.dispatchEvent(makeTouchEvent("touchmove", 200));
            container.dispatchEvent(makeTouchEvent("touchend", 200));

            await new Promise((r) => setTimeout(r, 50));
            expect(onRefresh).not.toHaveBeenCalled();
        });
    });
});
