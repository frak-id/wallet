import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/msw/server";
import { useGetActivePairings } from "./useListPairings";

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    return {
        ...actual,
        sessionStore: vi.fn(),
    };
});

describe("useGetActivePairings", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should not fetch when no wallet address is provided", async () => {
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue(null);

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
    });

    it("should fetch pairings list when wallet address is provided", async () => {
        const { sessionStore } = await import("../../stores/sessionStore");

        const mockSession = {
            type: "webauthn" as const,
            address: "0x1234567890123456789012345678901234567890" as Address,
            publicKey: "0xabc" as Address,
            authenticatorId: "auth-123",
            token: "mock-auth-token",
        };

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

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([
            {
                pairingId: "pairing-1",
                originName: "Device 1",
                targetName: "Wallet",
                createdAt: expect.any(Date),
                lastActiveAt: expect.any(Date),
            },
            {
                pairingId: "pairing-2",
                originName: "Device 2",
                targetName: "Wallet",
                createdAt: expect.any(Date),
                lastActiveAt: expect.any(Date),
            },
        ]);
    });

    it("should return null when API returns no data", async () => {
        const { sessionStore } = await import("../../stores/sessionStore");
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        server.use(
            http.get(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/list`,
                () => {
                    return HttpResponse.json(null);
                }
            )
        );

        const mockSession = {
            type: "webauthn" as const,
            address: "0x1234567890123456789012345678901234567890" as Address,
            publicKey: "0xabc" as Address,
            authenticatorId: "auth-123",
            token: "mock-auth-token",
        };

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

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith("No pairings found");

        consoleWarnSpy.mockRestore();
    });

    it("should return empty array when no pairings exist", async () => {
        const { sessionStore } = await import("../../stores/sessionStore");

        server.use(
            http.get(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/list`,
                () => {
                    return HttpResponse.json([]);
                }
            )
        );

        const mockSession = {
            type: "webauthn" as const,
            address: "0x1234567890123456789012345678901234567890" as Address,
            publicKey: "0xabc" as Address,
            authenticatorId: "auth-123",
            token: "mock-auth-token",
        };

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

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it("should refetch pairings when refetch is called", async () => {
        const { sessionStore } = await import("../../stores/sessionStore");
        let callCount = 0;

        server.use(
            http.get(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/list`,
                () => {
                    callCount++;
                    return HttpResponse.json([
                        {
                            pairingId: `pairing-${callCount}`,
                            originName: `Device ${callCount}`,
                            targetName: "Wallet",
                            createdAt: new Date(),
                            lastActiveAt: new Date(),
                        },
                    ]);
                }
            )
        );

        const mockSession = {
            type: "webauthn" as const,
            address: "0x1234567890123456789012345678901234567890" as Address,
            publicKey: "0xabc" as Address,
            authenticatorId: "auth-123",
            token: "mock-auth-token",
        };

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

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.[0]?.pairingId).toBe("pairing-1");

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.[0]?.pairingId).toBe("pairing-2");
        });
    });
});
