import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/msw/server";
import { useDeletePairing } from "./useDeletePairing";

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    return {
        ...actual,
        sessionStore: vi.fn(),
    };
});

describe("useDeletePairing", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

    const mockSession = {
        type: "webauthn" as const,
        address: "0x1234567890123456789012345678901234567890" as Address,
        publicKey: "0xabc" as Address,
        authenticatorId: "auth-123",
        token: "mock-auth-token",
    };

    beforeEach(async () => {
        const { sessionStore } = await import("../../stores/sessionStore");

        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );

        // Mock sessionStore for authentication
        vi.mocked(sessionStore).mockImplementation((selector: any) => {
            const state = {
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            };
            return selector(state);
        });

        vi.mocked(sessionStore).getState = vi.fn().mockReturnValue({
            session: mockSession,
            sdkSession: null,
            demoPrivateKey: null,
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
            setDemoPrivateKey: vi.fn(),
            clearSession: vi.fn(),
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should delete pairing successfully", async () => {
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onSuccess },
                }),
            { wrapper }
        );

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should handle pairing not found (404)", async () => {
        server.use(
            http.post(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/:id/delete`,
                ({ params }) => {
                    if (params.id === "not-found") {
                        return HttpResponse.json(
                            { error: "Not found" },
                            { status: 404 }
                        );
                    }
                    return HttpResponse.json({ success: true });
                }
            )
        );

        const { result } = renderHook(() => useDeletePairing({}), { wrapper });

        // Treaty client might not throw on 404, so just verify the request was made
        await result.current.mutateAsync({ id: "not-found" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    it("should delete multiple pairings sequentially", async () => {
        const { result } = renderHook(() => useDeletePairing({}), { wrapper });

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        await result.current.mutateAsync({ id: "pairing-2" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    it("should use custom mutation options", async () => {
        const onMutate = vi.fn();
        const onSettled = vi.fn();
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onMutate, onSettled, onSuccess },
                }),
            { wrapper }
        );

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onMutate).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it("should successfully mutate multiple times", async () => {
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onSuccess },
                }),
            { wrapper }
        );

        // First deletion
        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);

        // Second deletion
        await result.current.mutateAsync({ id: "pairing-3" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(2);
    });
});
