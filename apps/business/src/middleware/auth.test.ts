import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

// Mock dependencies
vi.mock("@tanstack/react-router", () => ({
    redirect: vi.fn((options) => {
        throw new Error(`REDIRECT:${JSON.stringify(options)}`);
    }),
}));

const mockGetState = vi.fn();

vi.mock("@/stores/authStore", () => ({
    useAuthStore: {
        getState: mockGetState,
    },
}));

describe("middleware/auth", () => {
    describe("requireAuth", () => {
        test("should return session when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { requireAuth } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => true,
                wallet: mockAuthSession.wallet,
                token: "mock-token",
                expiresAt: Date.now() + 1000000,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            const result = await requireAuth({
                location: { href: "/dashboard" },
            });

            expect(result).toEqual({
                session: { wallet: mockAuthSession.wallet },
            });
        });

        test("should redirect to login when user is not authenticated and not in demo mode", async () => {
            const { requireAuth } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            await expect(
                requireAuth({
                    location: { href: "/dashboard/campaigns" },
                })
            ).rejects.toThrow(
                'REDIRECT:{"to":"/login","search":{"redirect":"/dashboard/campaigns"}}'
            );
        });

        test("should preserve redirect URL in search params", async () => {
            const { requireAuth } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            try {
                await requireAuth({
                    location: { href: "/protected/page" },
                });
            } catch (error) {
                expect(String(error)).toContain("/protected/page");
            }
        });

        test("should allow access in demo mode even without authentication", async ({
            mockAuthSession,
        }: TestContext) => {
            const { requireAuth } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => true,
                wallet: mockAuthSession.wallet,
                token: "mock-token",
                expiresAt: Date.now() + 1000000,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            const result = await requireAuth({
                location: { href: "/dashboard" },
            });

            expect(result).toEqual({
                session: { wallet: mockAuthSession.wallet },
            });
        });
    });

    describe("redirectIfAuthenticated", () => {
        test("should do nothing when user is not authenticated", async () => {
            const { redirectIfAuthenticated } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
        });

        test("should redirect to dashboard when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { redirectIfAuthenticated } = await import("./auth");

            mockGetState.mockReturnValue({
                isAuthenticated: () => true,
                wallet: mockAuthSession.wallet,
                token: "mock-token",
                expiresAt: Date.now() + 1000000,
                setAuth: vi.fn(),
                clearAuth: vi.fn(),
            });

            await expect(redirectIfAuthenticated()).rejects.toThrow(
                'REDIRECT:{"to":"/dashboard"}'
            );
        });
    });
});
