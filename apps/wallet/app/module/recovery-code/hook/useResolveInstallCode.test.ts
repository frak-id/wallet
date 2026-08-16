/** @jsxImportSource react */
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

const mockResolvePost = vi.fn();

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
                anonymousId: "anon-1",
                merchant,
                hasWallet: false,
                ticket: "signed-ticket-jwt",
            },
            error: null,
        });

        const { useResolveInstallCode } = await import(
            "./useResolveInstallCode"
        );
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

    test("stays on anonymousId when the response has no ticket (old backend / rollback)", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-2",
                anonymousId: "anon-2",
                merchant,
                hasWallet: false,
            },
            error: null,
        });

        const { useResolveInstallCode } = await import(
            "./useResolveInstallCode"
        );
        const { result } = renderHook(() => useResolveInstallCode(), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.resolve("XYZ789");

        await waitFor(() => {
            const [action] = pendingActionsStore.getState().getValidActions();
            expect(action).toBeDefined();
            expect(
                action?.type === "ensure" ? action.anonymousId : undefined
            ).toBe("anon-2");
            expect(
                action?.type === "ensure" ? action.ticket : "unset"
            ).toBeUndefined();
        });
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

        const { useResolveInstallCode } = await import(
            "./useResolveInstallCode"
        );
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
});
