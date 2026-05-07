import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.fn();
const openUrlMock = vi.fn();

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
    openUrl: (url: string) => openUrlMock(url),
}));

const { openExternalUrl } = await import("./openExternalUrl");

describe("openExternalUrl", () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    });

    afterEach(() => {
        isTauriMock.mockReset();
        openUrlMock.mockReset();
        windowOpenSpy.mockRestore();
    });

    it("opens via window.open on the web", async () => {
        isTauriMock.mockReturnValue(false);

        await openExternalUrl("https://frak.id/terms");

        expect(windowOpenSpy).toHaveBeenCalledWith(
            "https://frak.id/terms",
            "_blank",
            "noopener,noreferrer"
        );
        expect(openUrlMock).not.toHaveBeenCalled();
    });

    it("delegates to the Tauri opener plugin when running in Tauri", async () => {
        isTauriMock.mockReturnValue(true);
        openUrlMock.mockResolvedValue(undefined);

        await openExternalUrl("mailto:hello@frak.id");

        expect(openUrlMock).toHaveBeenCalledWith("mailto:hello@frak.id");
        expect(windowOpenSpy).not.toHaveBeenCalled();
    });
});
