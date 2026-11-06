/** @jsxImportSource react */
import {
    type RenderHookOptions,
    renderHook,
    waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useLinkPurchaseIdentity } from "./useLinkPurchaseIdentity";

const api = vi.hoisted(() => ({
    generate: vi.fn(),
    resolve: vi.fn(),
    ensure: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                "install-code": {
                    generate: { post: api.generate },
                    resolve: { post: api.resolve },
                },
                ensure: { post: api.ensure },
            },
        },
    },
}));

const merchantId = "eec25ff7-a30f-47a5-8adc-02bb56ce0f04";
const checkoutToken = "checkout-token-1";
const merchant = { name: "Harmo", domain: "harmo-skincare.fr" };

const resolved = {
    data: { merchantId, merchant, hasWallet: false, ticket: "ticket-1" },
    error: null,
};
const unresolved = {
    data: { merchantId, merchant, hasWallet: false, outcome: "UNRESOLVED" },
    error: null,
};

describe("useLinkPurchaseIdentity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        pendingActionsStore.getState().clearAll();
        api.generate.mockResolvedValue({
            data: { code: "ABC123", expiresAt: "2026-11-09T00:00:00.000Z" },
            error: null,
        });
        api.resolve.mockResolvedValue(resolved);
        // Never settles: keeps the queued action observable.
        api.ensure.mockReturnValue(new Promise(() => {}));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function render(
        wrapper: RenderHookOptions<unknown>["wrapper"],
        overrides: { checkoutToken?: string; enabled?: boolean } = {}
    ) {
        return renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    checkoutToken,
                    enabled: true,
                    ...overrides,
                }),
            { wrapper }
        );
    }

    test("links the order identity through code, ticket and ensure", async ({
        queryWrapper,
    }) => {
        render(queryWrapper.wrapper);

        await waitFor(() => {
            expect(api.ensure).toHaveBeenCalledWith({
                merchantId,
                ticket: "ticket-1",
            });
        });
        expect(api.generate).toHaveBeenCalledWith({
            merchantId,
            checkoutToken,
        });
        expect(api.resolve).toHaveBeenCalledWith({ code: "ABC123" });
        expect(pendingActionsStore.getState().getValidActions()).toEqual([
            expect.objectContaining({
                type: "ensure",
                merchantId,
                ticket: "ticket-1",
            }),
        ]);
    });

    test("does nothing without a wallet session", async ({ queryWrapper }) => {
        render(queryWrapper.wrapper, { enabled: false });

        await vi.advanceTimersByTimeAsync(50);
        expect(api.generate).not.toHaveBeenCalled();
    });

    test("does nothing without a checkout token", async ({ queryWrapper }) => {
        render(queryWrapper.wrapper, { checkoutToken: undefined });

        await vi.advanceTimersByTimeAsync(50);
        expect(api.generate).not.toHaveBeenCalled();
    });

    test("stops on a refused token without resolving or retrying", async ({
        queryWrapper,
    }) => {
        api.generate.mockResolvedValue({
            data: null,
            error: { status: 404, value: { code: "MERCHANT_NOT_CONFIGURED" } },
        });
        render(queryWrapper.wrapper);

        await vi.advanceTimersByTimeAsync(5_000);
        expect(api.generate).toHaveBeenCalledTimes(1);
        expect(api.resolve).not.toHaveBeenCalled();
        expect(api.ensure).not.toHaveBeenCalled();
    });

    test("re-asks with the same code until the order resolves", async ({
        queryWrapper,
    }) => {
        api.resolve
            .mockResolvedValueOnce(unresolved)
            .mockResolvedValueOnce(unresolved)
            .mockResolvedValue(resolved);
        render(queryWrapper.wrapper);

        await vi.advanceTimersByTimeAsync(3_000);
        await waitFor(() => expect(api.ensure).toHaveBeenCalledTimes(1));
        expect(api.generate).toHaveBeenCalledTimes(1);
        expect(api.resolve).toHaveBeenCalledTimes(3);
        expect(api.resolve).toHaveBeenNthCalledWith(3, { code: "ABC123" });
    });

    test("gives up without queueing anything once the order never resolves", async ({
        queryWrapper,
    }) => {
        api.resolve.mockResolvedValue(unresolved);
        const { result } = render(queryWrapper.wrapper);

        await vi.advanceTimersByTimeAsync(15_000);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toBeNull();
        expect(api.resolve).toHaveBeenCalledTimes(5);
        expect(api.ensure).not.toHaveBeenCalled();
        expect(pendingActionsStore.getState().getValidActions()).toEqual([]);
    });

    test("retries a failed resolve without minting another code", async ({
        queryWrapper,
    }) => {
        api.resolve
            .mockResolvedValueOnce({ data: null, error: { status: 503 } })
            .mockResolvedValue(resolved);
        render(queryWrapper.wrapper);

        await vi.advanceTimersByTimeAsync(2_000);
        await waitFor(() => expect(api.ensure).toHaveBeenCalledTimes(1));
        expect(api.generate).toHaveBeenCalledTimes(1);
        expect(api.resolve).toHaveBeenCalledTimes(2);
    });
});
