/** @jsxImportSource react */
import { act, renderHook, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const mockNavigate = vi.fn();
const mockEnsurePost = vi.fn();

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

// Mocked at the deep specifiers `drainEnsures` actually imports, not at the
// `@frak-labs/wallet-shared` barrel: the barrel mock stopped covering the
// ensure path once the router-free half moved out of this hook.
vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                ensure: {
                    post: mockEnsurePost,
                },
            },
        },
    },
}));

vi.mock("@frak-labs/wallet-shared/common/analytics", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/wallet-shared/common/analytics")
        >();
    return {
        ...actual,
        trackEvent: vi.fn(),
        recordError: vi.fn(),
    };
});

describe("useExecutePendingActions — executeEnsure body", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnsurePost.mockResolvedValue({ error: null });
        pendingActionsStore.getState().clearAll();
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
    });

    test("drains an old-shape pending action (no ticket) via anonymousId", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.executePendingActions();
        });

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });
        });

        await waitFor(() => {
            expect(
                pendingActionsStore.getState().getValidActions()
            ).toHaveLength(0);
        });
    });

    test("drains a new-shape pending action using its ticket", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-2",
            anonymousId: "anon-2",
            ticket: "signed-ticket-jwt",
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.executePendingActions();
        });

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-2",
                anonymousId: "anon-2",
                ticket: "signed-ticket-jwt",
            });
        });
    });

    test("drains a pending action carrying a frak-install-v1 proof alongside the legacy pair", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-3",
            anonymousId: "anon-3",
            proof: "install-proof-blob",
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.executePendingActions();
        });

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-3",
                anonymousId: "anon-3",
                proof: "install-proof-blob",
            });
        });
    });

    test("drains a pending action carrying BOTH a ticket and a proof — every arm travels together", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-4",
            anonymousId: "anon-4",
            ticket: "signed-ticket-jwt",
            proof: "install-proof-blob",
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.executePendingActions();
        });

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-4",
                anonymousId: "anon-4",
                ticket: "signed-ticket-jwt",
                proof: "install-proof-blob",
            });
        });
    });
});

describe("useExecutePendingActions — navigation drain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnsurePost.mockResolvedValue({ error: null });
        pendingActionsStore.getState().clearAll();
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
    });

    test("navigates to the pending target, consumes it, and reports it handled", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
            search: { id: "abc" },
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        let handled: boolean | undefined;
        await act(async () => {
            handled = await result.current.executePendingActions();
        });

        expect(handled).toBe(true);
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/pairing",
            search: { id: "abc" },
            replace: true,
        });
        // Consumed: a second drain must not navigate again.
        expect(pendingActionsStore.getState().getValidActions()).toHaveLength(
            0
        );
    });

    test("reports not-handled and never navigates when nothing is pending", async ({
        queryWrapper,
    }) => {
        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        let handled: boolean | undefined;
        await act(async () => {
            handled = await result.current.executePendingActions();
        });

        expect(handled).toBe(false);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("skipNavigation drains ensures but leaves the navigation queued", async ({
        queryWrapper,
    }) => {
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
            search: { id: "abc" },
        });

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.executePendingActions({
                skipNavigation: true,
            });
        });

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(pendingActionsStore.getState().getValidActions()).toHaveLength(
            1
        );
    });

    test("a navigation target rejected at hydration never reaches navigate", async ({
        queryWrapper,
    }) => {
        localStorage.setItem(
            "frak_pending_actions_store",
            JSON.stringify({
                state: {
                    actions: [
                        {
                            type: "navigation",
                            to: "https://evil.example/steal",
                            id: "nav-evil",
                            createdAt: 1_700_000_000_000,
                            expiresAt: 4_000_000_000_000,
                        },
                    ],
                },
                version: 1,
            })
        );
        await pendingActionsStore.persist.rehydrate();

        const { useExecutePendingActions } = await import(
            "./useExecutePendingActions"
        );
        const { result } = renderHook(() => useExecutePendingActions(), {
            wrapper: queryWrapper.wrapper,
        });

        let handled: boolean | undefined;
        await act(async () => {
            handled = await result.current.executePendingActions();
        });

        expect(handled).toBe(false);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
