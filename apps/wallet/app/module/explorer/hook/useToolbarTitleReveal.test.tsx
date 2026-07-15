import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToolbarTitleReveal } from "./useToolbarTitleReveal";

// The hook creates two independent IntersectionObservers (hero → blur,
// title → centered title). The shared no-op mock never fires, so install a
// controllable one that records each observer alongside the element it
// observes, letting a test flip a single threshold and assert the matching
// boolean.
type RecordedObserver = {
    callback: IntersectionObserverCallback;
    elements: Element[];
    instance: IntersectionObserver;
};

let observers: RecordedObserver[] = [];

function TestHarness() {
    const { heroRef, titleRef, toolbarRef, blurred, revealed } =
        useToolbarTitleReveal();
    return (
        <div>
            <div ref={toolbarRef} data-testid="toolbar" />
            <div ref={heroRef} data-testid="hero" />
            <h1 ref={titleRef} data-testid="title">
                Merchant
            </h1>
            <span data-testid="blurred">{String(blurred)}</span>
            <span data-testid="revealed">{String(revealed)}</span>
        </div>
    );
}

function fireIntersection(element: Element, isIntersecting: boolean) {
    const observer = observers.find((o) => o.elements.includes(element));
    if (!observer) throw new Error("no IntersectionObserver for element");
    act(() => {
        observer.callback(
            [{ isIntersecting, target: element } as IntersectionObserverEntry],
            observer.instance
        );
    });
}

describe("useToolbarTitleReveal", () => {
    const original = global.IntersectionObserver;

    beforeEach(() => {
        observers = [];
        class MockIntersectionObserver {
            callback: IntersectionObserverCallback;
            elements: Element[] = [];
            constructor(callback: IntersectionObserverCallback) {
                this.callback = callback;
                observers.push({
                    callback,
                    elements: this.elements,
                    instance: this as unknown as IntersectionObserver,
                });
            }
            observe = (element: Element) => {
                this.elements.push(element);
            };
            unobserve = vi.fn();
            disconnect = vi.fn();
            takeRecords = vi.fn(() => []);
        }
        global.IntersectionObserver =
            MockIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
        global.IntersectionObserver = original;
    });

    it("is hidden until the user scrolls", () => {
        render(<TestHarness />);
        expect(screen.getByTestId("blurred")).toHaveTextContent("false");
        expect(screen.getByTestId("revealed")).toHaveTextContent("false");
    });

    it("fades the blur in once the hero scrolls behind the toolbar", () => {
        render(<TestHarness />);

        fireIntersection(screen.getByTestId("hero"), false);

        expect(screen.getByTestId("blurred")).toHaveTextContent("true");
        // The title stays hidden — it tracks the name, not the hero.
        expect(screen.getByTestId("revealed")).toHaveTextContent("false");
    });

    it("reveals the title once the name scrolls behind the toolbar", () => {
        render(<TestHarness />);

        fireIntersection(screen.getByTestId("title"), false);

        expect(screen.getByTestId("revealed")).toHaveTextContent("true");
        // The blur is independent — still hidden until the hero clears.
        expect(screen.getByTestId("blurred")).toHaveTextContent("false");
    });

    it("hides both again when scrolled back to the top", () => {
        render(<TestHarness />);
        const hero = screen.getByTestId("hero");
        const title = screen.getByTestId("title");

        fireIntersection(hero, false);
        fireIntersection(title, false);
        expect(screen.getByTestId("blurred")).toHaveTextContent("true");
        expect(screen.getByTestId("revealed")).toHaveTextContent("true");

        fireIntersection(hero, true);
        fireIntersection(title, true);
        expect(screen.getByTestId("blurred")).toHaveTextContent("false");
        expect(screen.getByTestId("revealed")).toHaveTextContent("false");
    });

    it("disconnects both observers on unmount", () => {
        const { unmount } = render(<TestHarness />);
        const disconnects = observers.map((o) => o.instance.disconnect);

        unmount();

        for (const disconnect of disconnects) {
            expect(disconnect).toHaveBeenCalledTimes(1);
        }
    });
});
