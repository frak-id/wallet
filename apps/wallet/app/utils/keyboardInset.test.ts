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

describe.sequential("initKeyboardInset", () => {
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = window.visualViewport;
    let rafCallbacks: Array<() => void> = [];
    let rafSpy: ReturnType<typeof vi.spyOn>;
    let cancelRafSpy: ReturnType<typeof vi.spyOn>;
    let cleanup: () => void = () => {};

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
        rafSpy.mockRestore();
        cancelRafSpy.mockRestore();
        document.documentElement.style.removeProperty("--viewport-height");
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
    });
});
