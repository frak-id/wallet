/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useDownloadRecoveryFile } from "./useDownloadRecoveryFile";

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isAndroid: vi.fn(() => false),
    isTauri: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
    downloadDir: vi.fn(),
    join: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    writeTextFile: vi.fn(),
    BaseDirectory: { Download: "Download" },
}));

describe("useDownloadRecoveryFile", () => {
    const mockFile: RecoveryFileContent = {
        initialWallet: {
            address: "0x1234567890123456789012345678901234567890",
            authenticatorId: "auth-id-123",
            publicKey: { x: "0x1234", y: "0x5678" },
        },
        guardianAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        guardianPrivateKeyEncrypted: "encrypted-key-base64",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.downloadRecoveryFile).toBeDefined();
        expect(result.current.downloadRecoveryFileAsync).toBeDefined();
    });

    test("should download via web method on standard browser", async ({
        queryWrapper,
    }) => {
        const { isAndroid, isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(false);
        vi.mocked(isTauri).mockReturnValue(false);

        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.downloadRecoveryFileAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    test("should use Web Share API on iOS/Tauri when available", async ({
        queryWrapper,
    }) => {
        const { isAndroid, isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(false);
        vi.mocked(isTauri).mockReturnValue(true);

        const mockShare = vi.fn().mockResolvedValue(undefined);
        const mockCanShare = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, "share", {
            value: mockShare,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: mockCanShare,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.downloadRecoveryFileAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockShare).toHaveBeenCalled();
    });

    test("should fallback to anchor download when Web Share not available on iOS/Tauri", async ({
        queryWrapper,
    }) => {
        const { isAndroid, isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(false);
        vi.mocked(isTauri).mockReturnValue(true);

        Object.defineProperty(navigator, "share", {
            value: undefined,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: undefined,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.downloadRecoveryFileAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test("should throw error when user cancels share", async ({
        queryWrapper,
    }) => {
        const { isAndroid, isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(false);
        vi.mocked(isTauri).mockReturnValue(true);

        const abortError = new Error("User cancelled");
        abortError.name = "AbortError";
        const mockShare = vi.fn().mockRejectedValue(abortError);
        const mockCanShare = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, "share", {
            value: mockShare,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: mockCanShare,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.downloadRecoveryFileAsync({ file: mockFile })
        ).rejects.toThrow("Download cancelled by user");
    });

    test("should use Tauri native share on Android", async ({
        queryWrapper,
    }) => {
        const { isAndroid } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isAndroid).mockReturnValue(true);

        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const { downloadDir, join } = await import("@tauri-apps/api/path");
        const { invoke } = await import("@tauri-apps/api/core");

        vi.mocked(writeTextFile).mockResolvedValue();
        vi.mocked(downloadDir).mockResolvedValue(
            "/storage/emulated/0/Download"
        );
        vi.mocked(join).mockResolvedValue(
            `/storage/emulated/0/Download/nexus-recovery-${mockFile.initialWallet.address}.json`
        );
        vi.mocked(invoke).mockResolvedValue(undefined);

        const { result } = renderHook(() => useDownloadRecoveryFile(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.downloadRecoveryFileAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(writeTextFile).toHaveBeenCalled();
    });
});
