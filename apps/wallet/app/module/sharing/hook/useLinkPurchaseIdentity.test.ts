/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
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

describe("useLinkPurchaseIdentity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
        api.generate.mockResolvedValue({
            data: { code: "ABC123", expiresAt: "2026-11-09T00:00:00.000Z" },
            error: null,
        });
        api.resolve.mockResolvedValue({
            data: {
                merchantId,
                merchant: { name: "Harmo", domain: "harmo-skincare.fr" },
                hasWallet: false,
                ticket: "ticket-1",
            },
            error: null,
        });
        // Never settles: keeps the queued action observable.
        api.ensure.mockReturnValue(new Promise(() => {}));
    });

    test("links the order identity through code, ticket and ensure", async ({
        queryWrapper,
    }) => {
        renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    checkoutToken,
                    enabled: true,
                }),
            { wrapper: queryWrapper.wrapper }
        );

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
        renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    checkoutToken,
                    enabled: false,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.generate).not.toHaveBeenCalled();
    });

    test("does nothing without a checkout token", async ({ queryWrapper }) => {
        renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    enabled: true,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.generate).not.toHaveBeenCalled();
    });

    test("stops on a refused token without resolving or retrying", async ({
        queryWrapper,
    }) => {
        api.generate.mockResolvedValue({
            data: null,
            error: { status: 404, value: { code: "MERCHANT_NOT_CONFIGURED" } },
        });
        const { result } = renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    checkoutToken,
                    enabled: true,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(api.generate).toHaveBeenCalledTimes(1);
        expect(api.resolve).not.toHaveBeenCalled();
        expect(api.ensure).not.toHaveBeenCalled();
    });

    test("queues nothing while the order is unresolved", async ({
        queryWrapper,
    }) => {
        api.resolve.mockResolvedValue({
            data: {
                merchantId,
                merchant: { name: "Harmo", domain: "harmo-skincare.fr" },
                hasWallet: false,
                outcome: "UNRESOLVED",
            },
            error: null,
        });
        const { result } = renderHook(
            () =>
                useLinkPurchaseIdentity({
                    merchantId,
                    checkoutToken,
                    enabled: true,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toBeNull();
        expect(api.ensure).not.toHaveBeenCalled();
        expect(pendingActionsStore.getState().getValidActions()).toEqual([]);
    });
});
