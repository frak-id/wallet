import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useOtaUpdate } from "@/module/version/hook/useOtaUpdate";
import { versionKey } from "@/module/version/queryKeys/version";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

const { stageOtaUpdateMock, isTauriMock } = vi.hoisted(() => ({
    stageOtaUpdateMock: vi.fn(),
    isTauriMock: vi.fn(),
}));

vi.mock("@/module/version/utils/otaUpdater", () => ({
    stageOtaUpdate: stageOtaUpdateMock,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return isTauriMock();
    },
    IS_ANDROID: false,
    IS_IOS: false,
    isStandalonePwa: () => false,
}));

describe("useOtaUpdate", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        stageOtaUpdateMock.mockReset();
        isTauriMock.mockReset().mockReturnValue(true);
    });

    test("never runs outside Tauri", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        isTauriMock.mockReturnValue(false);

        const { result } = renderHook(() => useOtaUpdate(), {
            wrapper: queryWrapper.wrapper,
        });

        await Promise.resolve();
        expect(stageOtaUpdateMock).not.toHaveBeenCalled();
        expect(result.current).toBe(false);
    });

    test("is true only once an update is staged", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        stageOtaUpdateMock.mockResolvedValue({ status: "staged" });

        const { result } = renderHook(() => useOtaUpdate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
    });

    test.for(["up_to_date", "unsupported"] as const)(
        "stays false when the pass reports %s",
        async (status, { queryWrapper }: WalletTestFixtures) => {
            stageOtaUpdateMock.mockResolvedValue({ status });

            const { result } = renderHook(() => useOtaUpdate(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);
            });
            await Promise.resolve();
            expect(result.current).toBe(false);
        }
    );

    test("checks once per session across remounts, focus and reconnect", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        stageOtaUpdateMock.mockResolvedValue({ status: "up_to_date" });

        const first = renderHook(() => useOtaUpdate(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => {
            expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);
        });
        first.unmount();
        renderHook(() => useOtaUpdate(), { wrapper: queryWrapper.wrapper });
        window.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);
    });

    test("does not retry a failed pass", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        stageOtaUpdateMock.mockRejectedValue(new Error("cdn down"));

        const { result } = renderHook(() => useOtaUpdate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(stageOtaUpdateMock).toHaveBeenCalledTimes(1);
        });
        const query = queryWrapper.client
            .getQueryCache()
            .find({ queryKey: versionKey.otaStatus });
        expect(query?.options.retry).toBe(false);
        expect(result.current).toBe(false);
    });
});
