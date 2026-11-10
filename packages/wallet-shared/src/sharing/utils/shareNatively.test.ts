import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canShareNatively, shareNatively } from "./shareNatively";

const { platform, invoke } = vi.hoisted(() => ({
    platform: { tauri: false },
    invoke: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return platform.tauri;
    },
}));
vi.mock("../../common/tauri", () => ({
    getInvoke: () => Promise.resolve(invoke),
}));

const share = vi.fn();

describe("shareNatively", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        platform.tauri = false;
        Object.assign(navigator, { share, canShare: () => true });
    });
    afterEach(() => {
        Reflect.deleteProperty(navigator, "share");
        Reflect.deleteProperty(navigator, "canShare");
    });

    it("goes through the frak-share plugin inside Tauri, even where WebKit exposes navigator.share", async () => {
        platform.tauri = true;
        invoke.mockResolvedValue({ shared: true });

        await expect(shareNatively({ text: "code" })).resolves.toBe(true);
        expect(invoke).toHaveBeenCalledExactlyOnceWith(
            "plugin:frak-share|share_text",
            { text: "code" }
        );
        expect(share).not.toHaveBeenCalled();
    });

    it("resolves false when the native sheet is dismissed", async () => {
        platform.tauri = true;
        invoke.mockResolvedValue({ shared: false });

        await expect(shareNatively({ text: "code" })).resolves.toBe(false);
    });

    it("rejects when the plugin fails", async () => {
        platform.tauri = true;
        invoke.mockRejectedValue("A share sheet is already open");

        await expect(shareNatively({ text: "code" })).rejects.toBe(
            "A share sheet is already open"
        );
    });

    it("uses the Web Share API on the web, without the plugin-only image", async () => {
        share.mockResolvedValue(undefined);

        await expect(
            shareNatively({ url: "https://x.test", imageUrl: "https://i" })
        ).resolves.toBe(true);
        expect(share).toHaveBeenCalledExactlyOnceWith({
            url: "https://x.test",
        });
    });

    it("resolves false when the web sheet is dismissed", async () => {
        share.mockRejectedValue(new DOMException("", "AbortError"));

        await expect(shareNatively({ text: "code" })).resolves.toBe(false);
    });

    it("can share inside Tauri or where the browser has navigator.share", () => {
        expect(canShareNatively()).toBe(true);
        Reflect.deleteProperty(navigator, "share");
        expect(canShareNatively()).toBe(false);
        platform.tauri = true;
        expect(canShareNatively()).toBe(true);
    });
});
