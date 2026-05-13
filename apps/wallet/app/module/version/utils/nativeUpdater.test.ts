import { beforeEach, describe, expect, it, vi } from "vitest";

const { addPluginListenerMock, isAndroidMock, isTauriMock } = vi.hoisted(
    () => ({
        addPluginListenerMock: vi.fn(),
        isAndroidMock: vi.fn(),
        isTauriMock: vi.fn(),
    })
);

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_ANDROID() {
        return isAndroidMock();
    },
    get IS_TAURI() {
        return isTauriMock();
    },
    get IS_IOS() {
        return false;
    },
    isStandalonePwa: () => false,
}));

vi.mock("@tauri-apps/api/core", () => ({
    addPluginListener: addPluginListenerMock,
}));

describe("listenToNativeUpdateStatus", () => {
    beforeEach(() => {
        addPluginListenerMock.mockReset();
        isAndroidMock.mockReset();
        isTauriMock.mockReset();
    });

    it("returns null when not running on Android", async () => {
        isAndroidMock.mockReturnValue(false);
        isTauriMock.mockReturnValue(true);

        const { listenToNativeUpdateStatus } = await import("./nativeUpdater");
        const result = await listenToNativeUpdateStatus(() => {});

        expect(result).toBeNull();
        expect(addPluginListenerMock).not.toHaveBeenCalled();
    });

    it("subscribes to the frak-updater 'update-status' channel on Android", async () => {
        isAndroidMock.mockReturnValue(true);
        isTauriMock.mockReturnValue(true);
        const fakeListener = { unregister: vi.fn() };
        addPluginListenerMock.mockResolvedValue(fakeListener);
        const handler = vi.fn();

        const { listenToNativeUpdateStatus } = await import("./nativeUpdater");
        const result = await listenToNativeUpdateStatus(handler);

        expect(addPluginListenerMock).toHaveBeenCalledTimes(1);
        expect(addPluginListenerMock).toHaveBeenCalledWith(
            "frak-updater",
            "update-status",
            handler
        );
        expect(result).toBe(fakeListener);
    });
});
