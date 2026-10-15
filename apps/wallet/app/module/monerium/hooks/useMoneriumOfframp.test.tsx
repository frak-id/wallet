/** @jsxImportSource react */
import {
    buildRedeemOrderMessage,
    MONERIUM_LIMITS,
} from "@frak-labs/app-essentials/monerium";
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    sign: vi.fn(),
    track: vi.fn(),
}));

vi.mock("wagmi", () => ({
    useSignMessage: () => ({ mutateAsync: mocks.sign }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        trackEvent: mocks.track,
        authenticatedWalletApi: { monerium: { orders: { post: mocks.post } } },
    };
});

import { useMoneriumOfframp } from "./useMoneriumOfframp";

const ORDER_ID = "6f0c2c43-7a8f-4c1e-9a7b-0d4a2a0d9a11";
const IBAN = "FR7630006000011234567890189";
const NOW = new Date("2026-10-15T10:00:30Z");

describe("useMoneriumOfframp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
        mocks.sign.mockResolvedValue("0xsig");
    });

    test("signs the shared-helper message dated 2 minutes ahead and posts it", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue({
            data: { orderId: ORDER_ID, order: null },
            error: null,
        });
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.placeOrder({
            orderId: ORDER_ID,
            amount: "12,5",
            iban: "FR76 3000 6000 0112 3456 7890 189",
            counterpart: { own: true },
            memo: "  ",
        });

        const expected = buildRedeemOrderMessage({
            amount: "12.5",
            iban: IBAN,
            at: new Date(
                NOW.getTime() + MONERIUM_LIMITS.MESSAGE_FUTURE_OFFSET_MS
            ),
        });
        expect(mocks.sign).toHaveBeenCalledWith({ message: expected });
        expect(mocks.post).toHaveBeenCalledWith({
            orderId: ORDER_ID,
            amount: "12.5",
            iban: IBAN,
            counterpart: { own: true },
            memo: undefined,
            message: expected,
            signature: "0xsig",
        });
        expect(mocks.track).toHaveBeenCalledWith("monerium_order_placed", {
            own: true,
            amount_bucket: "under_50",
        });
    });

    test("reuses the same orderId on retry after a failure", async ({
        queryWrapper,
    }) => {
        mocks.post
            .mockResolvedValueOnce({
                data: null,
                error: { status: 503, value: {} },
            })
            .mockResolvedValueOnce({
                data: { orderId: ORDER_ID, order: null },
                error: null,
            });
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });
        const params = {
            orderId: ORDER_ID,
            amount: "10",
            iban: IBAN,
            counterpart: { own: true as const },
        };

        await expect(result.current.placeOrder(params)).rejects.toThrow();
        await result.current.placeOrder(params);

        const ids = mocks.post.mock.calls.map(([body]) => body.orderId);
        expect(ids).toEqual([ORDER_ID, ORDER_ID]);
    });

    test("refuses a third-party payout at the 15 000 EUR threshold, not an own one", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue({
            data: { orderId: ORDER_ID, order: null },
            error: null,
        });
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.placeOrder({
                orderId: ORDER_ID,
                amount: "15000",
                iban: IBAN,
                counterpart: {
                    own: false,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    country: "FR",
                },
            })
        ).rejects.toMatchObject({ code: "MONERIUM_AMOUNT_LIMIT" });
        expect(mocks.sign).not.toHaveBeenCalled();

        await result.current.placeOrder({
            orderId: ORDER_ID,
            amount: "15000",
            iban: IBAN,
            counterpart: { own: true },
        });
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    test("an invalid amount never reaches the signer", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });
        await expect(
            result.current.placeOrder({
                orderId: ORDER_ID,
                amount: "abc",
                iban: IBAN,
                counterpart: { own: true },
            })
        ).rejects.toMatchObject({ code: "MONERIUM_INVALID_AMOUNT" });
        expect(mocks.sign).not.toHaveBeenCalled();
    });
});
