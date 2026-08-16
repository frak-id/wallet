import { beforeEach, describe, expect, test, vi } from "vitest";

const mockEnsurePost = vi.fn();
const mockRaise = vi.fn();
const mockRemoveAction = vi.fn();

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    recordError: vi.fn(),
    trackEvent: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                ensure: {
                    post: (...args: unknown[]) => mockEnsurePost(...args),
                },
            },
        },
    },
}));

vi.mock("@/module/pending-actions/stores/ensureConflictStore", () => ({
    ensureConflictStore: { getState: () => ({ raise: mockRaise }) },
}));

vi.mock("@/module/pending-actions/stores/pendingActionsStore", () => ({
    pendingActionsStore: {
        getState: () => ({
            removeAction: mockRemoveAction,
            addAction: vi.fn(),
            getValidActions: vi.fn(() => []),
        }),
    },
}));

import { fireEnsureActions } from "./drainEnsures";
import type { PendingAction } from "./types";

const ACTION: PendingAction = {
    id: "action-1",
    type: "ensure",
    merchantId: "merchant-1",
    anonymousId: "anon-1",
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
};

/** Let the fire-and-forget promise chain settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("fireEnsureActions — retry classification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each([
        "PROOF_REQUIRED",
        "PROOF_OR_TOKEN_REQUIRED",
        "MISSING_ANONYMOUS_ID",
        "RESERVED_IDENTITY",
    ])(
        "drops a queued action on %s without raising the toast",
        async (code) => {
            mockEnsurePost.mockResolvedValue({ error: { value: { code } } });

            fireEnsureActions([ACTION]);
            await flush();

            expect(mockRemoveAction).toHaveBeenCalledWith("action-1");
            expect(mockRaise).not.toHaveBeenCalled();
        }
    );

    test("drops the action and raises the toast on WALLET_ALREADY_LINKED", async () => {
        mockEnsurePost.mockResolvedValue({
            error: { value: { code: "WALLET_ALREADY_LINKED" } },
        });

        fireEnsureActions([ACTION]);
        await flush();

        expect(mockRemoveAction).toHaveBeenCalledWith("action-1");
        expect(mockRaise).toHaveBeenCalledTimes(1);
    });

    test("keeps the action queued on a transient failure", async () => {
        mockEnsurePost.mockResolvedValue({
            error: { value: { code: "INTERNAL_ERROR" } },
        });

        fireEnsureActions([ACTION]);
        await flush();

        expect(mockRemoveAction).not.toHaveBeenCalled();
        expect(mockRaise).not.toHaveBeenCalled();
    });

    test("removes the action on success", async () => {
        mockEnsurePost.mockResolvedValue({ error: undefined });

        fireEnsureActions([ACTION]);
        await flush();

        expect(mockRemoveAction).toHaveBeenCalledWith("action-1");
        expect(mockRaise).not.toHaveBeenCalled();
    });
});
