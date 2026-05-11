import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const {
    isAndroidMock,
    isTauriMock,
    isIOSMock,
    getInsetsMock,
    recordErrorMock,
} = vi.hoisted(() => ({
    isAndroidMock: vi.fn(() => false),
    isTauriMock: vi.fn(() => false),
    isIOSMock: vi.fn(() => false),
    getInsetsMock: vi.fn(),
    recordErrorMock: vi.fn(),
}));

// `IS_*` getters resolve through the same mocked function on each access, so
// `isAndroidMock.mockReturnValue(true)` continues to flip the platform branch
// even though the production code reads the constant directly.
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_ANDROID() {
        return isAndroidMock();
    },
    get IS_TAURI() {
        return isTauriMock();
    },
    get IS_IOS() {
        return isIOSMock();
    },
    isStandalonePwa: () => false,
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    recordError: recordErrorMock,
}));

vi.mock("tauri-plugin-safe-area-insets", () => ({
    getInsets: getInsetsMock,
}));

import { initSafeAreaInsets } from "./safeArea";

describe.sequential("initSafeAreaInsets", () => {
    beforeEach(() => {
        isAndroidMock.mockReset().mockReturnValue(false);
        isTauriMock.mockReset().mockReturnValue(false);
        isIOSMock.mockReset().mockReturnValue(false);
        getInsetsMock.mockReset();
        recordErrorMock.mockReset();
    });

    test("should not run when window is undefined", async () => {
        const originalWindow = global.window;
        // @ts-expect-error - Simulating SSR environment
        global.window = undefined;

        try {
            await initSafeAreaInsets();
        } finally {
            global.window = originalWindow;
        }
    });

    test("should not run on non-Android platforms", async () => {
        isAndroidMock.mockReturnValue(false);

        const setPropertySpy = vi.spyOn(
            document.documentElement.style,
            "setProperty"
        );

        await initSafeAreaInsets();

        expect(setPropertySpy).not.toHaveBeenCalled();
    });

    test("should set CSS variables on Android", async () => {
        isAndroidMock.mockReturnValue(true);
        getInsetsMock.mockResolvedValue({
            top: 24,
            bottom: 48,
            left: 0,
            right: 0,
        });

        const setPropertySpy = vi.spyOn(
            document.documentElement.style,
            "setProperty"
        );

        await initSafeAreaInsets();

        expect(setPropertySpy).toHaveBeenCalledWith(
            "--safe-area-inset-top",
            "24px"
        );
        expect(setPropertySpy).toHaveBeenCalledWith(
            "--safe-area-inset-bottom",
            "48px"
        );
        expect(setPropertySpy).toHaveBeenCalledWith(
            "--safe-area-inset-left",
            "0px"
        );
        expect(setPropertySpy).toHaveBeenCalledWith(
            "--safe-area-inset-right",
            "0px"
        );
    });

    test("should handle errors gracefully", async () => {
        isAndroidMock.mockReturnValue(true);
        getInsetsMock.mockRejectedValue(new Error("Plugin not available"));

        await expect(initSafeAreaInsets()).resolves.not.toThrow();

        expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), {
            source: "safe_area",
        });
    });
});
