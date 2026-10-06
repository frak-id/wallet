import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const { isTauriMock } = vi.hoisted(() => ({
    isTauriMock: vi.fn(() => true),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return isTauriMock();
    },
}));

import { initKeyboardInset } from "./keyboardInset";

type FakeVisualViewport = {
    height: number;
    offsetTop: number;
    listeners: Map<string, Set<() => void>>;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
    dispatch: (type: string) => void;
};

function createFakeViewport(height: number): FakeVisualViewport {
    const listeners = new Map<string, Set<() => void>>();
    return {
        height,
        offsetTop: 0,
        listeners,
        addEventListener(type, listener) {
            const set = listeners.get(type) ?? new Set();
            set.add(listener);
            listeners.set(type, set);
        },
        removeEventListener(type, listener) {
            listeners.get(type)?.delete(listener);
        },
        dispatch(type) {
            const set = listeners.get(type);
            if (!set) return;
            for (const l of set) l();
        },
    };
}

describe("initKeyboardInset", () => {
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = window.visualViewport;
    let rafCallbacks: Array<() => void> = [];
    let rafSpy: ReturnType<typeof vi.spyOn>;
    let cancelRafSpy: ReturnType<typeof vi.spyOn>;
    let cleanup: () => void = () => {};
    let mounted: HTMLElement[] = [];

    beforeEach(() => {
        isTauriMock.mockReset().mockReturnValue(true);
        rafCallbacks = [];
        rafSpy = vi
            .spyOn(window, "requestAnimationFrame")
            .mockImplementation((cb) => {
                rafCallbacks.push(() => cb(0));
                return rafCallbacks.length;
            });
        cancelRafSpy = vi
            .spyOn(window, "cancelAnimationFrame")
            .mockImplementation(() => {});
        Object.defineProperty(window, "innerHeight", {
            configurable: true,
            value: 800,
        });
    });

    afterEach(() => {
        cleanup();
        Object.defineProperty(window, "innerHeight", {
            configurable: true,
            value: originalInnerHeight,
        });
        Object.defineProperty(window, "visualViewport", {
            configurable: true,
            value: originalVisualViewport,
        });
        for (const node of mounted) node.remove();
        mounted = [];
        rafSpy.mockRestore();
        cancelRafSpy.mockRestore();
        document.documentElement.style.removeProperty("--viewport-height");
        document.documentElement.style.removeProperty("--keyboard-open");
    });

    function flushRaf() {
        const queued = rafCallbacks;
        rafCallbacks = [];
        for (const cb of queued) cb();
    }

    function installViewport(height: number) {
        const vv = createFakeViewport(height);
        Object.defineProperty(window, "visualViewport", {
            configurable: true,
            value: vv,
        });
        return vv;
    }

    test("is a no-op outside Tauri", () => {
        isTauriMock.mockReturnValue(false);
        const vv = installViewport(800);

        cleanup = initKeyboardInset();

        expect(vv.listeners.size).toBe(0);
        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("");
    });

    test("seeds --viewport-height to the current visualViewport height", () => {
        installViewport(800);

        cleanup = initKeyboardInset();

        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("800px");
    });

    test("updates --viewport-height when visualViewport shrinks", () => {
        const vv = installViewport(800);

        cleanup = initKeyboardInset();

        vv.height = 500;
        vv.dispatch("resize");
        flushRaf();

        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("500px");

        vv.height = 800;
        vv.dispatch("resize");
        flushRaf();

        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("800px");
    });

    test("flags --keyboard-open when the viewport shrinks past the threshold", () => {
        const vv = installViewport(800);

        cleanup = initKeyboardInset();

        expect(
            document.documentElement.style.getPropertyValue("--keyboard-open")
        ).toBe("0");

        vv.height = 500;
        vv.dispatch("resize");
        flushRaf();
        expect(
            document.documentElement.style.getPropertyValue("--keyboard-open")
        ).toBe("1");

        vv.height = 800;
        vv.dispatch("resize");
        flushRaf();
        expect(
            document.documentElement.style.getPropertyValue("--keyboard-open")
        ).toBe("0");
    });

    test("ignores sub-threshold shrinkage (toolbar jitter)", () => {
        const vv = installViewport(800);

        cleanup = initKeyboardInset();

        vv.height = 740;
        vv.dispatch("resize");
        flushRaf();
        expect(
            document.documentElement.style.getPropertyValue("--keyboard-open")
        ).toBe("0");
    });

    test("coalesces multiple events into a single rAF callback", () => {
        const vv = installViewport(800);

        cleanup = initKeyboardInset();

        vv.height = 600;
        vv.dispatch("resize");
        vv.dispatch("scroll");
        vv.dispatch("resize");

        expect(rafSpy).toHaveBeenCalledTimes(1);

        flushRaf();

        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("600px");
    });

    // iPhone SE with the keyboard up: main spans 0-407 with 36/16px padding and
    // an 88px sticky footer, so fields must sit between y=36 and y=303.
    function mountField(top: number) {
        const main = document.createElement("main");
        main.style.paddingTop = "36px";
        main.style.paddingBottom = "16px";
        const page = document.createElement("div");
        page.style.setProperty("--footer-height", "88px");
        const field = document.createElement("input");
        page.append(field);
        main.append(page);
        document.body.append(main);
        mounted.push(main);
        main.getBoundingClientRect = () => ({ top: 0, bottom: 407 }) as DOMRect;
        field.getBoundingClientRect = () =>
            ({ top, bottom: top + 26, height: 26 }) as DOMRect;
        const scrollBy = vi.fn();
        main.scrollBy = scrollBy as typeof main.scrollBy;
        return { main, field, scrollBy };
    }

    test("centres a focused field the sticky footer covers once the keyboard opens", () => {
        const vv = installViewport(667);
        cleanup = initKeyboardInset();
        const { field, scrollBy } = mountField(293);
        field.focus();

        vv.height = 407;
        vv.dispatch("resize");
        flushRaf();

        expect(scrollBy).toHaveBeenCalledWith({
            top: 306 - (36 + 303) / 2,
            behavior: "smooth",
        });
    });

    test("leaves an uncovered field in place", () => {
        const vv = installViewport(667);
        cleanup = initKeyboardInset();
        const { field, scrollBy } = mountField(200);
        field.focus();

        vv.height = 407;
        vv.dispatch("resize");
        flushRaf();

        expect(scrollBy).not.toHaveBeenCalled();
    });

    test("leaves fields outside the page scroller to their drawer or dialog", () => {
        const vv = installViewport(667);
        cleanup = initKeyboardInset();
        const { scrollBy } = mountField(200);
        const drawerField = document.createElement("input");
        document.body.append(drawerField);
        mounted.push(drawerField);
        drawerField.focus();

        vv.height = 407;
        vv.dispatch("resize");
        flushRaf();

        expect(scrollBy).not.toHaveBeenCalled();
    });

    test("reveals a field focused while the keyboard is already open", () => {
        const vv = installViewport(667);
        cleanup = initKeyboardInset();
        const { field, scrollBy } = mountField(293);
        vv.height = 407;
        vv.dispatch("resize");
        flushRaf();
        expect(scrollBy).not.toHaveBeenCalled();

        field.focus();
        flushRaf();

        expect(scrollBy).toHaveBeenCalledTimes(1);
    });

    test("ignores focus while the keyboard is closed", () => {
        installViewport(667);
        cleanup = initKeyboardInset();
        const { field, scrollBy } = mountField(600);

        field.focus();
        flushRaf();

        expect(scrollBy).not.toHaveBeenCalled();
    });

    test("cleanup removes listeners and the CSS variable", () => {
        const vv = installViewport(800);

        cleanup = initKeyboardInset();
        cleanup();
        cleanup = () => {};

        expect(vv.listeners.get("resize")?.size ?? 0).toBe(0);
        expect(vv.listeners.get("scroll")?.size ?? 0).toBe(0);
        expect(
            document.documentElement.style.getPropertyValue("--viewport-height")
        ).toBe("");
        expect(
            document.documentElement.style.getPropertyValue("--keyboard-open")
        ).toBe("");
    });
});
