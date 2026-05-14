import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useVersionGate } from "@/module/version/hook/useVersionGate";
import type { NativeUpdateStatus } from "@/module/version/utils/nativeUpdater";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

const {
    checkNativeUpdateMock,
    listenToNativeUpdateStatusMock,
    isAndroidMock,
    isIosMock,
    isTauriMock,
    backendVersionGetMock,
} = vi.hoisted(() => ({
    checkNativeUpdateMock: vi.fn(),
    listenToNativeUpdateStatusMock: vi.fn(),
    isAndroidMock: vi.fn(),
    isIosMock: vi.fn(),
    isTauriMock: vi.fn(),
    backendVersionGetMock: vi.fn(),
}));

vi.mock("@/module/version/utils/nativeUpdater", () => ({
    checkNativeUpdate: checkNativeUpdateMock,
    listenToNativeUpdateStatus: listenToNativeUpdateStatusMock,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_ANDROID() {
        return isAndroidMock();
    },
    get IS_IOS() {
        return isIosMock();
    },
    get IS_TAURI() {
        return isTauriMock();
    },
    isStandalonePwa: () => false,
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        authenticatedBackendApi: {
            common: {
                version: { get: backendVersionGetMock },
            },
        },
    };
});

const idleNativeStatus: NativeUpdateStatus = {
    status: "up_to_date",
    currentVersion: "1.2.3",
};

describe.sequential("useVersionGate", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        checkNativeUpdateMock.mockReset().mockResolvedValue(idleNativeStatus);
        listenToNativeUpdateStatusMock.mockReset().mockResolvedValue(null);
        isAndroidMock.mockReset().mockReturnValue(true);
        isIosMock.mockReset().mockReturnValue(false);
        isTauriMock.mockReset().mockReturnValue(true);
        backendVersionGetMock
            .mockReset()
            .mockResolvedValue({ data: { minVersion: { android: "0.0.0" } } });
    });

    test("subscribes to the native push channel on Android+Tauri", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        renderHook(() => useVersionGate(), { wrapper: queryWrapper.wrapper });

        await waitFor(() => {
            expect(listenToNativeUpdateStatusMock).toHaveBeenCalledTimes(1);
        });
        // First call argument should be the handler the hook hands the helper.
        expect(listenToNativeUpdateStatusMock.mock.calls[0][0]).toBeTypeOf(
            "function"
        );
    });

    test("does not subscribe when running outside Tauri", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        isTauriMock.mockReturnValue(false);

        renderHook(() => useVersionGate(), { wrapper: queryWrapper.wrapper });

        // Wait a microtask cycle so any pending effects flush.
        await Promise.resolve();
        expect(listenToNativeUpdateStatusMock).not.toHaveBeenCalled();
    });

    test("does not subscribe on iOS", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        isAndroidMock.mockReturnValue(false);
        isIosMock.mockReturnValue(true);

        renderHook(() => useVersionGate(), { wrapper: queryWrapper.wrapper });

        await Promise.resolve();
        expect(listenToNativeUpdateStatusMock).not.toHaveBeenCalled();
    });

    test("writes incoming native events into the query cache", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        let capturedHandler: ((event: NativeUpdateStatus) => void) | undefined;
        listenToNativeUpdateStatusMock.mockImplementation((handler) => {
            capturedHandler = handler;
            return Promise.resolve({ unregister: vi.fn() });
        });

        renderHook(() => useVersionGate(), { wrapper: queryWrapper.wrapper });

        await waitFor(() => {
            expect(capturedHandler).toBeDefined();
        });

        const inProgress: NativeUpdateStatus = {
            status: "in_progress",
            currentVersion: "1.2.3",
            bytesDownloaded: 100,
            totalBytes: 1000,
        };
        capturedHandler?.(inProgress);

        expect(
            queryWrapper.client.getQueryData(["version", "native-status"])
        ).toEqual(inProgress);
    });

    test("unregisters the listener on unmount", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const unregister = vi.fn();
        listenToNativeUpdateStatusMock.mockResolvedValue({ unregister });

        const { unmount } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(listenToNativeUpdateStatusMock).toHaveBeenCalled();
        });
        unmount();

        await waitFor(() => {
            expect(unregister).toHaveBeenCalledTimes(1);
        });
    });

    test("unregisters immediately when unmounted before listener resolves", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const unregister = vi.fn();
        let resolveListener: (value: { unregister: () => void }) => void = () =>
            undefined;
        listenToNativeUpdateStatusMock.mockReturnValue(
            new Promise((resolve) => {
                resolveListener = resolve;
            })
        );

        const { unmount } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        // Unmount before the listener registration resolves to exercise the
        // cancellation guard.
        unmount();
        resolveListener({ unregister });

        await waitFor(() => {
            expect(unregister).toHaveBeenCalledTimes(1);
        });
    });
});
