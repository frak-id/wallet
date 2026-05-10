import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

const platformMocks = vi.hoisted(() => ({
    isTauri: vi.fn(() => false),
}));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return platformMocks.isTauri();
    },
}));

// Import after mocks so the module picks them up.
const { openExternalUrl } = await import("./openExternalUrl");

describe("openExternalUrl", () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        platformMocks.isTauri.mockReturnValue(false);
        windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    });

    afterEach(() => {
        windowOpenSpy.mockRestore();
    });

    it("opens via window.open on the web", async () => {
        await openExternalUrl("https://frak.id/terms");

        expect(windowOpenSpy).toHaveBeenCalledWith(
            "https://frak.id/terms",
            "_blank",
            "noopener,noreferrer"
        );
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("delegates to the Tauri opener plugin when running in Tauri", async () => {
        platformMocks.isTauri.mockReturnValue(true);
        invokeMock.mockResolvedValue(undefined);

        await openExternalUrl("mailto:hello@frak.id");

        expect(invokeMock).toHaveBeenCalledWith("plugin:opener|open_url", {
            url: "mailto:hello@frak.id",
        });
        expect(windowOpenSpy).not.toHaveBeenCalled();
    });
});
