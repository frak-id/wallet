/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { moneriumOrder, moneriumStatus, ok } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ orders: vi.fn(), status: vi.fn() }));

vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    isMoneriumEnabled: true,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: {
            monerium: {
                orders: { get: mocks.orders },
                status: { get: mocks.status },
            },
        },
    };
});

import { useMoneriumOrders } from "./useMoneriumOrders";

describe("useMoneriumOrders", () => {
    beforeEach(() => vi.clearAllMocks());

    test("does not fetch orders when the status says not connected", async ({
        queryWrapper,
    }) => {
        mocks.status.mockResolvedValue(
            ok(moneriumStatus({ connection: "none", profile: null }))
        );
        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(mocks.status).toHaveBeenCalled());
        expect(mocks.orders).not.toHaveBeenCalled();
        expect(result.current.orders).toEqual([]);
    });

    test("returns the flattened DTO once connected, outside the persisted cache", async ({
        queryWrapper,
    }) => {
        mocks.status.mockResolvedValue(ok(moneriumStatus()));
        mocks.orders.mockResolvedValue(ok({ orders: [moneriumOrder()] }));

        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.orders).toHaveLength(1));
        expect(result.current.orders[0]?.counterpart.iban).toBe("EE52");
        expect(
            queryWrapper.client.getQueryCache().find({
                queryKey: moneriumKey.orders,
            })?.meta
        ).toEqual({ storable: false });
    });
});
