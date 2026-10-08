import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useVersionGate } from "@/module/version/hook/useVersionGate";
import { versionKey } from "@/module/version/queryKeys/version";
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

async function waitForBothQueries(client: QueryClient) {
    await waitFor(() => {
        expect(client.getQueryData(versionKey.minSupported)).toBeDefined();
        expect(client.getQueryData(versionKey.nativeStatus)).toBeDefined();
    });
}

function setAndroidFloor(floor: string) {
    backendVersionGetMock.mockResolvedValue({
        data: { minVersion: { ios: "0.0.0", android: floor } },
    });
}

describe("useVersionGate hard floor", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        checkNativeUpdateMock.mockReset().mockResolvedValue(idleNativeStatus);
        listenToNativeUpdateStatusMock.mockReset().mockResolvedValue(null);
        isAndroidMock.mockReset().mockReturnValue(true);
        isIosMock.mockReset().mockReturnValue(false);
        isTauriMock.mockReset().mockReturnValue(true);
        backendVersionGetMock.mockReset();
        vi.stubEnv("APP_VERSION", "1.0.98");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("gates on the build version when the native lookup returns no version", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.99");
        checkNativeUpdateMock.mockResolvedValue({
            status: "up_to_date",
            currentVersion: "",
        });

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                kind: "hard_update",
                currentVersion: "1.0.98",
                minVersion: "1.0.99",
            });
        });
    });

    test("gates on the build version when the native lookup rejects", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.99");
        checkNativeUpdateMock.mockRejectedValue(new Error("offline"));

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.kind).toBe("hard_update");
        });
    });

    test("prefers the build version over the native one", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.99");
        checkNativeUpdateMock.mockResolvedValue({
            status: "up_to_date",
            currentVersion: "2.0.0",
        });

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toMatchObject({
                kind: "hard_update",
                currentVersion: "1.0.98",
            });
        });
    });

    test("does not gate a build at or above the floor", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.98");
        checkNativeUpdateMock.mockRejectedValue(new Error("offline"));

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(
                queryWrapper.client.getQueryData(versionKey.minSupported)
            ).toBeDefined();
        });
        expect(result.current.kind).toBe("idle");
    });

    test("never gates on a 0.0.0 floor", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("0.0.0");
        vi.stubEnv("APP_VERSION", "0.0.0");

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitForBothQueries(queryWrapper.client);
        expect(result.current.kind).toBe("idle");
    });

    test("falls back to the native version when APP_VERSION is a commit hash", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.99");
        vi.stubEnv("APP_VERSION", "a7117ad");
        checkNativeUpdateMock.mockResolvedValue({
            status: "up_to_date",
            currentVersion: "1.1.0",
        });

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitForBothQueries(queryWrapper.client);
        expect(result.current.kind).toBe("idle");
    });

    test("still offers the soft update from native data above the floor", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        setAndroidFloor("1.0.90");
        checkNativeUpdateMock.mockResolvedValue({
            status: "available",
            currentVersion: "1.0.98",
            storeVersion: "1.0.99",
        });

        const { result } = renderHook(() => useVersionGate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                kind: "soft_update",
                storeVersion: "1.0.99",
            });
        });
    });
});

describe("useVersionGate", () => {
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
