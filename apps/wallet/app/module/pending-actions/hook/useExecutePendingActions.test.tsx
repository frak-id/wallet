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

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        recordError: vi.fn(),
        authenticatedBackendApi: {
            user: {
                identity: {
                    ensure: {
                        post: mockEnsurePost,
                    },
                },
            },
        },
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
});
