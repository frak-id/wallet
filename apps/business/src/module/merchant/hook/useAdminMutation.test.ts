import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { useAdminMutation } from "./useAdminMutation";

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn((_args: { merchantId: string }) => ({
            admins: vi.fn((_args: { adminId: string }) => ({
                delete: vi.fn(),
            })),
        })),
    },
}));

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
}

function createWrapper(queryClient: QueryClient) {
    return ({ children }: { children: ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
}

describe("useAdminMutation", () => {
    it("adds an existing account directly by email (status: active)", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockPost = vi.fn().mockResolvedValue({
            data: {
                id: "admin-new",
                wallet: null,
                accountId: "account-1",
                email: "teammate@example.com",
                addedBy: "0x0000000000000000000000000000000000000000",
                addedAt: "2024-01-01T00:00:00.000Z",
                isOwner: false,
                status: "active",
            },
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { post: mockPost },
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "add" }),
            {
                wrapper: createWrapper(queryClient),
            }
        );

        const data = await result.current.mutateAsync({
            merchantId: "merchant-1",
            email: "teammate@example.com",
        });

        expect(mockPost).toHaveBeenCalledWith({
            email: "teammate@example.com",
        });
        expect(data?.status).toBe("active");
    });

    it("invites an unknown email (status: invited)", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockPost = vi.fn().mockResolvedValue({
            data: {
                id: "admin-new",
                wallet: null,
                accountId: "account-invited-1",
                email: "invitee@example.com",
                addedBy: "0x0000000000000000000000000000000000000000",
                addedAt: "2024-01-01T00:00:00.000Z",
                isOwner: false,
                status: "invited",
            },
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { post: mockPost },
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "add" }),
            {
                wrapper: createWrapper(queryClient),
            }
        );

        const data = await result.current.mutateAsync({
            merchantId: "merchant-1",
            email: "invitee@example.com",
        });

        expect(data?.status).toBe("invited");
    });

    it("invites an admin by wallet", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const;
        const mockPost = vi.fn().mockResolvedValue({
            data: {
                id: "admin-new",
                wallet,
                accountId: null,
                email: null,
                addedBy: "0x0000000000000000000000000000000000000000",
                addedAt: "2024-01-01T00:00:00.000Z",
                isOwner: false,
            },
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { post: mockPost },
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "add" }),
            {
                wrapper: createWrapper(queryClient),
            }
        );

        await result.current.mutateAsync({ merchantId: "merchant-1", wallet });

        expect(mockPost).toHaveBeenCalledWith({ wallet });
    });

    it("surfaces a backend error from the add endpoint", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const edenError = {
            status: 403,
            value: { message: "Access denied" },
        };
        const mockPost = vi.fn().mockResolvedValue({
            data: null,
            error: edenError,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { post: mockPost },
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "add" }),
            {
                wrapper: createWrapper(queryClient),
            }
        );

        await expect(
            result.current.mutateAsync({
                merchantId: "merchant-1",
                email: "someone@example.com",
            })
        ).rejects.toEqual(edenError);

        try {
            await result.current.mutateAsync({
                merchantId: "merchant-1",
                email: "someone@example.com",
            });
        } catch (error) {
            expect(extractAuthErrorMessage(error, "fallback")).toBe(
                "Access denied"
            );
        }
    });

    it("removes an admin by id", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockDelete = vi.fn().mockResolvedValue({ data: {}, error: null });
        const mockAdmins = vi.fn((_args: { adminId: string }) => ({
            delete: mockDelete,
        }));

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: mockAdmins,
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "remove" }),
            { wrapper: createWrapper(queryClient) }
        );

        await result.current.mutateAsync({
            merchantId: "merchant-1",
            adminId: "admin-3",
        });

        expect(mockAdmins).toHaveBeenCalledWith({ adminId: "admin-3" });
        expect(mockDelete).toHaveBeenCalled();
    });

    it("invalidates the team query on successful removal", async () => {
        const queryClient = createQueryClient();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockDelete = vi.fn().mockResolvedValue({ data: {}, error: null });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: vi.fn(() => ({ delete: mockDelete })),
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "remove" }),
            { wrapper: createWrapper(queryClient) }
        );

        await result.current.mutateAsync({
            merchantId: "merchant-1",
            adminId: "admin-3",
        });

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["merchant", "team", "merchant-1"],
            });
        });
    });

    it("rejects when removal fails", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const edenError = { status: 403, value: "Forbidden" };
        const mockDelete = vi
            .fn()
            .mockResolvedValue({ data: null, error: edenError });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: vi.fn(() => ({ delete: mockDelete })),
        } as any);

        const { result } = renderHook(
            () => useAdminMutation({ action: "remove" }),
            { wrapper: createWrapper(queryClient) }
        );

        await expect(
            result.current.mutateAsync({
                merchantId: "merchant-1",
                adminId: "admin-3",
            })
        ).rejects.toEqual(edenError);
    });
});
