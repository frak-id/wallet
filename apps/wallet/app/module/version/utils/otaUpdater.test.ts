import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkMock, setChannelMock, isTauriMock } = vi.hoisted(() => ({
    checkMock: vi.fn(),
    setChannelMock: vi.fn(),
    isTauriMock: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return isTauriMock();
    },
    get IS_ANDROID() {
        return false;
    },
    get IS_IOS() {
        return false;
    },
    isStandalonePwa: () => false,
}));

vi.mock("@crabnebula/plugin-ota-updater", () => ({
    check: checkMock,
    setChannel: setChannelMock,
}));

/** Stands in for the `vite.defines.ts` substitution. */
function setChannelDefine(channel: string | null) {
    (globalThis as Record<string, unknown>).__OTA_CHANNEL__ = channel;
}

describe("stageOtaUpdate", () => {
    beforeEach(() => {
        checkMock.mockReset();
        setChannelMock.mockReset().mockResolvedValue(undefined);
        isTauriMock.mockReset().mockReturnValue(true);
        setChannelDefine("prod-ios-1.0.93");
    });

    it("reports unsupported outside Tauri without touching the plugin", async () => {
        isTauriMock.mockReturnValue(false);

        const { stageOtaUpdate } = await import("./otaUpdater");

        expect(await stageOtaUpdate()).toEqual({ status: "unsupported" });
        expect(checkMock).not.toHaveBeenCalled();
    });

    it("reports up_to_date when the plugin returns no update", async () => {
        isTauriMock.mockReturnValue(true);
        checkMock.mockResolvedValue(null);

        const { stageOtaUpdate } = await import("./otaUpdater");

        expect(await stageOtaUpdate()).toEqual({ status: "up_to_date" });
    });

    it("applies the update and reports staged", async () => {
        const apply = vi.fn().mockResolvedValue(undefined);
        checkMock.mockResolvedValue({ apply });

        const { stageOtaUpdate } = await import("./otaUpdater");

        expect(await stageOtaUpdate()).toEqual({ status: "staged" });
        expect(apply).toHaveBeenCalledOnce();
    });

    it("propagates a plugin failure instead of masking it", async () => {
        checkMock.mockRejectedValue(new Error("cdn unreachable"));

        const { stageOtaUpdate } = await import("./otaUpdater");

        await expect(stageOtaUpdate()).rejects.toThrow("cdn unreachable");
    });

    it("pins the channel to this build's stage, platform and version", async () => {
        setChannelDefine("prod-android-1.0.94");
        checkMock.mockResolvedValue(null);

        const { stageOtaUpdate } = await import("./otaUpdater");
        await stageOtaUpdate();

        expect(setChannelMock).toHaveBeenCalledWith("prod-android-1.0.94");
    });

    it("refuses to pull assets when the build has no channel", async () => {
        setChannelDefine(null);

        const { stageOtaUpdate } = await import("./otaUpdater");

        expect(await stageOtaUpdate()).toEqual({ status: "unsupported" });
        expect(setChannelMock).not.toHaveBeenCalled();
        expect(checkMock).not.toHaveBeenCalled();
    });
});
