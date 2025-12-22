import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isAndroid: vi.fn(() => false),
}));

vi.mock("tauri-plugin-safe-area-insets", () => ({
    getInsets: vi.fn(),
}));

describe("initSafeAreaInsets", () => {
    let originalSetProperty: typeof document.documentElement.style.setProperty;

    beforeEach(() => {
        vi.clearAllMocks();
        originalSetProperty = document.documentElement.style.setProperty;
    });

    afterEach(() => {
        document.documentElement.style.setProperty = originalSetProperty;
        vi.restoreAllMocks();
    });

    test("should not run when window is undefined", async () => {
        const originalWindow = global.window;
        // @ts-expect-error - Simulating SSR environment
        global.window = undefined;

        const { initSafeAreaInsets } = await import("./safeArea");
        await initSafeAreaInsets();

        global.window = originalWindow;
    });

    test("should not run on non-Android platforms", async () => {
        const { isAndroid } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(false);

        const mockSetProperty = vi.fn();
        document.documentElement.style.setProperty = mockSetProperty;

        vi.resetModules();
        const { initSafeAreaInsets } = await import("./safeArea");
        await initSafeAreaInsets();

        expect(mockSetProperty).not.toHaveBeenCalled();
    });

    test("should set CSS variables on Android", async () => {
        const { isAndroid } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(true);

        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        vi.mocked(getInsets).mockResolvedValue({
            top: 24,
            bottom: 48,
            left: 0,
            right: 0,
        });

        const mockSetProperty = vi.fn();
        document.documentElement.style.setProperty = mockSetProperty;

        vi.resetModules();
        const { initSafeAreaInsets } = await import("./safeArea");
        await initSafeAreaInsets();

        expect(mockSetProperty).toHaveBeenCalledWith(
            "--safe-area-inset-top",
            "24px"
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
            "--safe-area-inset-bottom",
            "48px"
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
            "--safe-area-inset-left",
            "0px"
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
            "--safe-area-inset-right",
            "0px"
        );
    });

    test("should handle errors gracefully", async () => {
        const { isAndroid } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(true);

        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        vi.mocked(getInsets).mockRejectedValue(
            new Error("Plugin not available")
        );

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        vi.resetModules();
        const { initSafeAreaInsets } = await import("./safeArea");

        await expect(initSafeAreaInsets()).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
            "Failed to get safe area insets:",
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });
});
