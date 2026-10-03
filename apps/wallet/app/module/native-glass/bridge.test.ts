import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, addPluginListenerMock, recordErrorMock } = vi.hoisted(
    () => ({
        invokeMock: vi.fn(),
        addPluginListenerMock: vi.fn(),
        recordErrorMock: vi.fn(),
    })
);

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
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
    dispatch(payload);
}

async function loadBridge() {
    vi.resetModules();
    return import("./bridge");
}

async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
    dispatchers = [];
    invokeMock.mockReset().mockResolvedValue(undefined);
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

describe("onNativeEvent", () => {
    it("registers an event natively once across many subscribe/unsubscribe cycles", async () => {
        const { onNativeEvent } = await loadBridge();

        for (let i = 0; i < 10; i++) {
            const unsubscribe = onNativeEvent("tap", vi.fn());
            await flushMicrotasks();
            unsubscribe();
        }
        onNativeEvent("tap", vi.fn());
        await flushMicrotasks();

        expect(addPluginListenerMock).toHaveBeenCalledOnce();
        expect(addPluginListenerMock).toHaveBeenCalledWith(
            "frak-glass",
            "tap",
            expect.any(Function)
        );
    });

    it("delivers one native event to every current subscriber but not to an unsubscribed one", async () => {
        const { onNativeEvent } = await loadBridge();
        const first = vi.fn();
        const second = vi.fn();
        const gone = vi.fn();

        onNativeEvent("tap", first);
        const unsubscribe = onNativeEvent("tap", gone);
        onNativeEvent("tap", second);
        unsubscribe();
        await flushMicrotasks();

        emit({ id: 1 });

        expect(first).toHaveBeenCalledExactlyOnceWith({ id: 1 });
        expect(second).toHaveBeenCalledExactlyOnceWith({ id: 1 });
        expect(gone).not.toHaveBeenCalled();
    });

    it("keeps delivering the event to the others when a handler unsubscribes during dispatch", async () => {
        const { onNativeEvent } = await loadBridge();
        const before = vi.fn();
        const after = vi.fn();
        let unsubscribeSelf: () => void = () => {};
        const selfRemoving = vi.fn(() => unsubscribeSelf());

        onNativeEvent("tap", before);
        unsubscribeSelf = onNativeEvent("tap", selfRemoving);
        onNativeEvent("tap", after);
        await flushMicrotasks();

        emit("first");
        expect(before).toHaveBeenCalledExactlyOnceWith("first");
        expect(selfRemoving).toHaveBeenCalledExactlyOnceWith("first");
        expect(after).toHaveBeenCalledExactlyOnceWith("first");

        emit("second");
        expect(selfRemoving).toHaveBeenCalledOnce();
        expect(before).toHaveBeenLastCalledWith("second");
        expect(after).toHaveBeenLastCalledWith("second");
    });

    it("reports a failed registration and retries it on the next subscribe", async () => {
        const { onNativeEvent } = await loadBridge();
        const failure = new Error("listener table busy");
        addPluginListenerMock.mockRejectedValueOnce(failure);
        const early = vi.fn();
        const late = vi.fn();

        onNativeEvent("tap", early);
        await flushMicrotasks();

        expect(recordErrorMock).toHaveBeenCalledExactlyOnceWith(failure, {
            source: "native_glass",
        });

        onNativeEvent("tap", late);
        await flushMicrotasks();

        expect(addPluginListenerMock).toHaveBeenCalledTimes(2);
        emit("after-retry");
        expect(early).toHaveBeenCalledExactlyOnceWith("after-retry");
        expect(late).toHaveBeenCalledExactlyOnceWith("after-retry");
    });
});

describe("createNativeSync", () => {
    it("reports a rejected invoke and sends the full merged state on the next patch", async () => {
        const { createNativeSync } = await loadBridge();
        const failure = new Error("ipc closed");
        invokeMock.mockRejectedValueOnce(failure);
        const sync = createNativeSync("set_surface", {
            title: "",
            visible: false,
            count: 0,
        });

        sync({ title: "Share" });
        await flushMicrotasks();

        expect(recordErrorMock).toHaveBeenCalledExactlyOnceWith(failure, {
            source: "native_glass",
        });

        sync({ visible: true });
        await flushMicrotasks();

        expect(invokeMock).toHaveBeenCalledTimes(2);
        expect(invokeMock).toHaveBeenLastCalledWith(
            "plugin:frak-glass|set_surface",
            { title: "Share", visible: true, count: 0 }
        );
    });
});
