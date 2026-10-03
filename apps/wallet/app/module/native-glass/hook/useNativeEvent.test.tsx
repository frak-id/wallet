import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addPluginListenerMock, recordErrorMock } = vi.hoisted(() => ({
    addPluginListenerMock: vi.fn(),
    recordErrorMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
    addPluginListener: addPluginListenerMock,
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    recordError: recordErrorMock,
}));

type Dispatch = (payload: unknown) => void;

let dispatchers: Dispatch[] = [];

function emit(payload: unknown) {
    const dispatch = dispatchers.at(-1);
    if (!dispatch) throw new Error("no native listener registered");
    act(() => dispatch(payload));
}

async function loadHook() {
    vi.resetModules();
    return (await import("./useNativeEvent")).useNativeEvent;
}

async function flush() {
    await act(async () => {});
}

describe("useNativeEvent", () => {
    beforeEach(() => {
        dispatchers = [];
        recordErrorMock.mockReset();
        addPluginListenerMock
            .mockReset()
            .mockImplementation(
                async (_plugin: string, _event: string, handler: Dispatch) => {
                    dispatchers.push(handler);
                    return { unregister: vi.fn() };
                }
            );
    });

    it("registers the event natively once across many mount/unmount cycles", async () => {
        const useNativeEvent = await loadHook();

        for (let i = 0; i < 5; i++) {
            const { unmount } = renderHook(() =>
                useNativeEvent("tap", vi.fn())
            );
            await flush();
            unmount();
        }
        renderHook(() => useNativeEvent("tap", vi.fn()));
        await flush();

        expect(addPluginListenerMock).toHaveBeenCalledOnce();
    });

    it("delivers one native event to every mounted subscriber but not to an unmounted one", async () => {
        const useNativeEvent = await loadHook();
        const first = vi.fn();
        const second = vi.fn();
        const gone = vi.fn();

        renderHook(() => useNativeEvent("tap", first));
        const removed = renderHook(() => useNativeEvent("tap", gone));
        renderHook(() => useNativeEvent("tap", second));
        await flush();
        removed.unmount();

        emit({ key: "/wallet" });

        expect(first).toHaveBeenCalledExactlyOnceWith({ key: "/wallet" });
        expect(second).toHaveBeenCalledExactlyOnceWith({ key: "/wallet" });
        expect(gone).not.toHaveBeenCalled();
    });

    it("reports a failed registration and retries it on the next mount", async () => {
        const useNativeEvent = await loadHook();
        const failure = new Error("listener table busy");
        addPluginListenerMock.mockRejectedValueOnce(failure);
        const early = vi.fn();
        const late = vi.fn();

        renderHook(() => useNativeEvent("tap", early));
        await flush();

        expect(recordErrorMock).toHaveBeenCalledExactlyOnceWith(failure, {
            source: "native_glass",
        });

        renderHook(() => useNativeEvent("tap", late));
        await flush();

        expect(addPluginListenerMock).toHaveBeenCalledTimes(2);
        emit("after-retry");
        expect(early).toHaveBeenCalledExactlyOnceWith("after-retry");
        expect(late).toHaveBeenCalledExactlyOnceWith("after-retry");
    });
});
