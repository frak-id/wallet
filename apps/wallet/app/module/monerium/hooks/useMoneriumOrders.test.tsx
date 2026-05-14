/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useMoneriumOrders } from "@/module/monerium/hooks/useMoneriumOrders";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("wagmi", () => ({
    useConnection: vi.fn(),
}));

vi.mock("@/module/monerium/utils/moneriumApi", () => ({
    getOrders: vi.fn(),
    isMoneriumRetryable: vi.fn(() => false),
}));

const WALLET = "0x1111111111111111111111111111111111111111" as const;

describe("useMoneriumOrders", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
        moneriumStore.setState({
            accessToken: "tok",
            refreshToken: "rt",
            tokenExpiry: Date.now() + 60_000,
            pendingCodeVerifier: null,
            pendingState: null,
            hasSeenSetupSuccess: true,
        });
    });

    test("does not fetch when wallet address is missing", async ({
        queryWrapper,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockReturnValue({ address: undefined } as any);

        const { getOrders } = await import(
            "@/module/monerium/utils/moneriumApi"
        );

        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.orders).toEqual([]);
        expect(getOrders).not.toHaveBeenCalled();
    });

    test("does not fetch when monerium is not connected", async ({
        queryWrapper,
    }) => {
        moneriumStore.setState({ accessToken: null });
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockReturnValue({ address: WALLET } as any);

        const { getOrders } = await import(
            "@/module/monerium/utils/moneriumApi"
        );

        renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(getOrders).not.toHaveBeenCalled();
    });

    test("fetches orders filtered by wallet address", async ({
        queryWrapper,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockReturnValue({ address: WALLET } as any);

        const { getOrders } = await import(
            "@/module/monerium/utils/moneriumApi"
        );
        vi.mocked(getOrders).mockResolvedValue({
            orders: [
                {
                    id: "o1",
                    profile: "p1",
                    address: WALLET,
                    kind: "redeem",
                    chain: "arbitrum",
                    amount: "5",
                    currency: "eur",
                    counterpart: {
                        identifier: { standard: "iban", iban: "EE52" },
                        details: {},
                    },
                    memo: "",
                    meta: { placedAt: "2024-01-01T00:00:00Z" },
                    state: "pending",
                },
            ],
        });

        const { result } = renderHook(() => useMoneriumOrders(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(getOrders).toHaveBeenCalledWith({ address: WALLET });
        expect(result.current.orders).toHaveLength(1);
        expect(result.current.orders[0]?.id).toBe("o1");
    });
});
