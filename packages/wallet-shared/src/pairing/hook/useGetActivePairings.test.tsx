import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
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
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should not fetch when no wallet address is provided", async ({
        queryWrapper,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue(null);

        const { result } = renderHook(() => useGetActivePairings(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
    });

    test("should fetch pairings list when wallet address is provided", async ({
        queryWrapper,
        mockSession,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");

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
            wrapper: queryWrapper.wrapper,
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

    test("should return null when API returns no data", async ({
        queryWrapper,
        mockSession,
    }) => {
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
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith("No pairings found");

        consoleWarnSpy.mockRestore();
    });

    test("should return empty array when no pairings exist", async ({
        queryWrapper,
        mockSession,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");

        server.use(
            http.get(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/list`,
                () => {
                    return HttpResponse.json([]);
                }
            )
        );

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
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    test("should refetch pairings when refetch is called", async ({
        queryWrapper,
        mockSession,
    }) => {
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
            wrapper: queryWrapper.wrapper,
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
