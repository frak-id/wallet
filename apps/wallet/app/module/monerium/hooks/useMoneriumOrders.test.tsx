/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
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

const status = (connection: "connected" | "none") => ({
    connection,
    profile: null,
    walletLink: "none",
    silentReconnect: false,
    environment: "sandbox",
});

const order = {
    id: "o1",
    kind: "redeem",
    state: "pending",
    amount: "5",
    currency: "eur",
    chain: "arbitrum",
    address: "0x1111111111111111111111111111111111111111",
    counterpart: { iban: "EE52", own: false },
    placedAt: "2024-01-01T00:00:00Z",
    txHashes: [],
};

describe("useMoneriumOrders", () => {
    beforeEach(() => vi.clearAllMocks());

    test("does not fetch orders when the status says not connected", async ({
        queryWrapper,
    }) => {
        mocks.status.mockResolvedValue({ data: status("none"), error: null });
        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(mocks.status).toHaveBeenCalled());
        expect(mocks.orders).not.toHaveBeenCalled();
        expect(result.current.orders).toEqual([]);
    });

    test("returns the flattened DTO once connected", async ({
        queryWrapper,
    }) => {
        queryWrapper.client.setQueryData(
            moneriumKey.status,
            status("connected")
        );
        mocks.status.mockResolvedValue({
            data: status("connected"),
            error: null,
        });
        mocks.orders.mockResolvedValue({
            data: { orders: [order] },
            error: null,
        });

        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.orders).toHaveLength(1));
        expect(result.current.orders[0]?.counterpart.iban).toBe("EE52");
    });
});
