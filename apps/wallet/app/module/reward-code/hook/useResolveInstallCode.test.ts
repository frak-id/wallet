/** @jsxImportSource react */

import { trackEvent } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useResolveInstallCode } from "./useResolveInstallCode";

const mockResolvePost = vi.hoisted(() => vi.fn());

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        setInstallSource: vi.fn(),
        authenticatedBackendApi: {
            user: {
                identity: {
                    "install-code": {
                        resolve: {
                            post: mockResolvePost,
                        },
                    },
                },
            },
        },
    };
});

const merchant = { name: "Acme", domain: "acme.example" };

describe("useResolveInstallCode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pendingActionsStore.getState().clearAll();
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
    });

    test("stores the ticket on the pending action when the response includes one", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-1",
                merchant,
                hasWallet: false,
                ticket: "signed-ticket-jwt",
            },
            error: null,
        });

        const { result } = renderHook(() => useResolveInstallCode(), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.resolve("ABC123");

        await waitFor(() => {
            const [action] = pendingActionsStore.getState().getValidActions();
            expect(action).toBeDefined();
            expect(action?.type === "ensure" ? action.ticket : undefined).toBe(
                "signed-ticket-jwt"
            );
        });
    });

    test("queues nothing when the response carries no ticket", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-2",
                merchant,
                hasWallet: false,
            },
            error: null,
        });

        const { result } = renderHook(() => useResolveInstallCode(), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.resolve("XYZ789");

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
        expect(pendingActionsStore.getState().getValidActions()).toHaveLength(
            0
        );
    });

    test("queues nothing when the backend reports an UNRESOLVED outcome", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-3",
                merchant,
                hasWallet: false,
                outcome: "UNRESOLVED",
            },
            error: null,
        });

        const { result } = renderHook(() => useResolveInstallCode(), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.resolve("UNRES1");

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
        expect(pendingActionsStore.getState().getValidActions()).toHaveLength(
            0
        );
    });

    test("tags a resolution with the surface it was typed on", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: { merchantId: "merchant-1", merchant, hasWallet: false },
            error: null,
        });

        const { result } = renderHook(
            () => useResolveInstallCode({ surface: "referral_code" }),
            { wrapper: queryWrapper.wrapper }
        );

        result.current.resolve("ABC123");

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(trackEvent).toHaveBeenCalledWith(
            "install_code_resolved",
            expect.objectContaining({ surface: "referral_code" })
        );
    });

    test.for([
        ["reward_code", 404, "CODE_NOT_FOUND", true],
        ["reward_code", 404, "REFERRAL_CODE", false],
        ["referral_code", 404, "CODE_NOT_FOUND", false],
        ["referral_code", 404, "REFERRAL_CODE", false],
        ["referral_code", 429, "RATE_LIMITED", true],
        ["referral_code", 500, "INTERNAL_ERROR", true],
    ] as const)(
        "on %s, a %i %s reports a failure: %s",
        async ([surface, status, code, reported], { queryWrapper }) => {
            mockResolvePost.mockResolvedValue({
                data: null,
                error: { status, value: { code } },
            });

            const { result } = renderHook(
                () => useResolveInstallCode({ surface }),
                { wrapper: queryWrapper.wrapper }
            );
            result.current.resolve("ABC123");
            await waitFor(() => expect(result.current.isError).toBe(true));

            if (reported) {
                expect(trackEvent).toHaveBeenCalledWith(
                    "install_code_resolve_failed",
                    { error_code: code }
                );
            } else {
                expect(trackEvent).not.toHaveBeenCalled();
            }
        }
    );
});
