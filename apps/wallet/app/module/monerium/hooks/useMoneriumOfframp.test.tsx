/** @jsxImportSource react */
import {
    buildRedeemOrderMessage,
    MONERIUM_LIMITS,
} from "@frak-labs/app-essentials/monerium";
import type * as WalletShared from "@frak-labs/wallet-shared";
import { balanceKey } from "@frak-labs/wallet-shared";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { fail, ok } from "@/tests/moneriumFixtures";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

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

import {
    type PlaceOrderParams,
    useMoneriumOfframp,
} from "./useMoneriumOfframp";

const ORDER_ID = "6f0c2c43-7a8f-4c1e-9a7b-0d4a2a0d9a11";
const IBAN = "FR7630006000011234567890189";
const NOW = new Date("2026-10-15T10:00:30Z");
const PARAMS: PlaceOrderParams = {
    orderId: ORDER_ID,
    amount: "10",
    iban: IBAN,
    counterpart: { own: true },
};
const PLACED = ok({ orderId: ORDER_ID, order: null });

describe("useMoneriumOfframp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
        mocks.sign.mockResolvedValue("0xsig");
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("signs the shared-helper message dated 2 minutes ahead and posts it", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(PLACED);
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.placeOrderAsync({
            ...PARAMS,
            amount: "12,5",
            iban: "FR76 3000 6000 0112 3456 7890 189",
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
        for (const queryKey of [
            moneriumKey.orders,
            moneriumKey.status,
            balanceKey.baseKey,
        ]) {
            expect(invalidate).toHaveBeenCalledWith({ queryKey });
        }
    });

    test("posts a third-party payout above the document threshold", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(PLACED);
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.placeOrderAsync({
            ...PARAMS,
            amount: "15000",
            counterpart: {
                own: false,
                firstName: "Ada",
                lastName: "Lovelace",
                country: "FR",
            },
        });
        expect(mocks.post).toHaveBeenCalledOnce();
    });

    test("an invalid amount never reaches the signer", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });
        await expect(
            result.current.placeOrderAsync({ ...PARAMS, amount: "abc" })
        ).rejects.toMatchObject({ code: "MONERIUM_INVALID_AMOUNT" });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    test("an idempotent retry that returns a rejected order is a failure", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(
            ok({ orderId: ORDER_ID, order: { state: "rejected" } })
        );
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.placeOrderAsync(PARAMS)
        ).rejects.toMatchObject({ code: "MONERIUM_ORDER_REJECTED" });
        expect(mocks.track).not.toHaveBeenCalledWith(
            "monerium_order_placed",
            expect.anything()
        );
    });

    test("a failed order refetches the status and reports its code", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(fail(422, "MONERIUM_INVALID_IBAN"));
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMoneriumOfframp(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.placeOrderAsync(PARAMS)
        ).rejects.toMatchObject({ code: "MONERIUM_INVALID_IBAN" });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: moneriumKey.status,
        });
        expect(mocks.track).toHaveBeenCalledWith("monerium_order_failed", {
            own: true,
            amount_bucket: "under_50",
            code: "MONERIUM_INVALID_IBAN",
        });
    });
});
