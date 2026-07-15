import { renderHook } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useCompletePendingSession } from "./useCompletePendingSession";

const { mockSessionsGet, mockGetState, mockSetAuth } = vi.hoisted(() => ({
    mockSessionsGet: vi.fn(),
    mockGetState: vi.fn(),
    mockSetAuth: vi.fn(),
}));

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        auth: {
            sessions: {
                get: mockSessionsGet,
            },
        },
    },
}));

vi.mock("@/stores/authStore", () => ({
    useAuthStore: {
        getState: mockGetState,
    },
}));

describe("useCompletePendingSession", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("resolves the current session and clears pending2fa", async ({
        queryWrapper,
    }: TestContext) => {
        mockGetState.mockReturnValue({
            token: "pending-token",
            wallet: "0x1234567890123456789012345678901234567890",
            accountId: "account-1",
            setAuth: mockSetAuth,
        });
        mockSessionsGet.mockResolvedValue({
            data: [
                { current: false, authMethod: "siwe", expiresAt: 111 },
                { current: true, authMethod: "password", expiresAt: 99999 },
            ],
            error: null,
        });

        const { result } = renderHook(() => useCompletePendingSession(), {
            wrapper: queryWrapper.wrapper,
        });

        const current = await result.current.mutateAsync();

        expect(current).toEqual({
            current: true,
            authMethod: "password",
            expiresAt: 99999,
        });
        expect(mockSetAuth).toHaveBeenCalledWith({
            token: "pending-token",
            wallet: "0x1234567890123456789012345678901234567890",
            accountId: "account-1",
            authMethod: "password",
            expiresAt: 99999,
            pending2fa: false,
        });
    });

    test("rejects when no session has current: true (§1.9 / M9)", async ({
        queryWrapper,
    }: TestContext) => {
        mockGetState.mockReturnValue({
            token: "pending-token",
            wallet: null,
            accountId: null,
            setAuth: mockSetAuth,
        });
        mockSessionsGet.mockResolvedValue({
            data: [{ current: false, authMethod: "siwe", expiresAt: 111 }],
            error: null,
        });

        const { result } = renderHook(() => useCompletePendingSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Could not resolve the verified session"
        );
        expect(mockSetAuth).not.toHaveBeenCalled();
    });

    test("rejects when the sessions fetch returns an Eden error", async ({
        queryWrapper,
    }: TestContext) => {
        mockGetState.mockReturnValue({
            token: "pending-token",
            wallet: null,
            accountId: null,
            setAuth: mockSetAuth,
        });
        mockSessionsGet.mockResolvedValue({
            data: null,
            error: { status: 500, value: "Server error" },
        });

        const { result } = renderHook(() => useCompletePendingSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Could not resolve session"
        );
        expect(mockSetAuth).not.toHaveBeenCalled();
    });

    test("rejects when there is no pending token", async ({
        queryWrapper,
    }: TestContext) => {
        mockGetState.mockReturnValue({
            token: null,
            wallet: null,
            accountId: null,
            setAuth: mockSetAuth,
        });
        mockSessionsGet.mockResolvedValue({
            data: [{ current: true, authMethod: "siwe", expiresAt: 99999 }],
            error: null,
        });

        const { result } = renderHook(() => useCompletePendingSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "No pending session"
        );
        expect(mockSetAuth).not.toHaveBeenCalled();
    });
});
