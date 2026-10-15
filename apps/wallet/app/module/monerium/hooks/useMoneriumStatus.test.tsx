/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    isMoneriumEnabled: false,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: { monerium: { status: { get: mocks.get } } },
    };
});

import { useMoneriumStatus } from "./useMoneriumStatus";

describe("useMoneriumStatus", () => {
    beforeEach(() => vi.clearAllMocks());

    test("exposes the refresh failure", async ({ queryWrapper }) => {
        mocks.get.mockResolvedValue({
            data: null,
            error: { status: 502, value: {} },
        });
        const { result } = renderHook(() => useMoneriumStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.refresh()).rejects.toThrow();
        await waitFor(() => expect(result.current.refreshError).toBeTruthy());
    });
});
