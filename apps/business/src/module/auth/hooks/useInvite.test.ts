import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useInviteClaim, useInvitePreview } from "./useInvite";

const { mockPreview, mockClaim } = vi.hoisted(() => ({
    mockPreview: vi.fn(),
    mockClaim: vi.fn(),
}));

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        auth: {
            invite: {
                preview: { post: mockPreview },
                claim: { post: mockClaim },
            },
        },
    },
}));

describe("merchant-team invitation hooks", () => {
    afterEach(() => {
        vi.clearAllMocks();
        useAuthStore.getState().clearAuth();
    });

    describe("useInvitePreview", () => {
        test("resolves the invitation context on a valid token", async ({
            queryWrapper,
        }: TestContext) => {
            mockPreview.mockResolvedValue({
                data: {
                    email: "invitee@test.com",
                    merchantName: "Acme",
                    inviterName: "Jane",
                    alreadyClaimed: false,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useInvitePreview("some-token"),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual({
                email: "invitee@test.com",
                merchantName: "Acme",
                inviterName: "Jane",
                alreadyClaimed: false,
            });
            expect(mockPreview).toHaveBeenCalledWith({ token: "some-token" });
        });

        test("does not fire without a token", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(() => useInvitePreview(undefined), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(mockPreview).not.toHaveBeenCalled();
        });

        test("surfaces the generic invalid-token message on error", async ({
            queryWrapper,
        }: TestContext) => {
            mockPreview.mockResolvedValue({
                data: null,
                error: {
                    status: 400,
                    value: {
                        code: "INVALID_INVITATION",
                        error: "This invitation link is invalid or has expired",
                    },
                },
            });

            const { result } = renderHook(() => useInvitePreview("bad-token"), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(result.current.error?.message).toBe(
                "This invitation link is invalid or has expired"
            );
        });
    });

    describe("useInviteClaim", () => {
        test("claims the invitation and stores an already-verified session", async ({
            queryWrapper,
        }: TestContext) => {
            mockClaim.mockResolvedValue({
                data: {
                    token: "session-token",
                    accountId: "account-1",
                    expiresAt: Date.now() + 60_000,
                    merchantId: "merchant-1",
                    hasMerchantAccess: true,
                },
                error: null,
            });

            const { result } = renderHook(() => useInviteClaim(), {
                wrapper: queryWrapper.wrapper,
            });

            const data = await result.current.mutateAsync({
                token: "some-token",
                password: "a-strong-password",
            });

            expect(data.hasMerchantAccess).toBe(true);
            expect(data.merchantId).toBe("merchant-1");

            // The store is populated directly, not left pending — claiming
            // is not a pending-2FA login (link possession is the 2FA proof).
            const state = useAuthStore.getState();
            expect(state.token).toBe("session-token");
            expect(state.accountId).toBe("account-1");
            expect(state.authMethod).toBe("password");
            expect(state.pending2fa).toBe(false);
            expect(state.isAuthenticated()).toBe(true);
        });

        test("surfaces the generic error on an invalid/expired token", async ({
            queryWrapper,
        }: TestContext) => {
            mockClaim.mockResolvedValue({
                data: null,
                error: {
                    status: 400,
                    value: {
                        code: "INVALID_INVITATION",
                        error: "This invitation link is invalid or has expired",
                    },
                },
            });

            const { result } = renderHook(() => useInviteClaim(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    token: "bad-token",
                    password: "a-strong-password",
                })
            ).rejects.toThrow("This invitation link is invalid or has expired");
            expect(useAuthStore.getState().token).toBeNull();
        });
    });
});
