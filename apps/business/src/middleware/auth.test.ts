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

vi.mock("@/stores/authStore", () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}));

describe("middleware/auth", () => {
    describe("requireAuth", () => {
        test("should return session when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");
            const { requireAuth } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => true,
                wallet: mockAuthSession.wallet,
                token: "mock-token",
                expiresAt: Date.now() + 1000000,
                isDemoMode: false,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
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
            const { useAuthStore } = await import("@/stores/authStore");
            const { requireAuth } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                isDemoMode: false,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
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
            const { useAuthStore } = await import("@/stores/authStore");
            const { requireAuth } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                isDemoMode: false,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
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
            const { useAuthStore } = await import("@/stores/authStore");
            const { requireAuth } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => false,
                wallet: mockAuthSession.wallet,
                token: null,
                expiresAt: null,
                isDemoMode: true,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
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
            const { useAuthStore } = await import("@/stores/authStore");
            const { redirectIfAuthenticated } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => false,
                wallet: null,
                token: null,
                expiresAt: null,
                isDemoMode: false,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
                clearAuth: vi.fn(),
            });

            await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
        });

        test("should redirect to dashboard when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");
            const { redirectIfAuthenticated } = await import("./auth");

            vi.mocked(useAuthStore.getState).mockReturnValue({
                isAuthenticated: () => true,
                wallet: mockAuthSession.wallet,
                token: "mock-token",
                expiresAt: Date.now() + 1000000,
                isDemoMode: false,
                setAuth: vi.fn(),
                setDemoMode: vi.fn(),
                clearAuth: vi.fn(),
            });

            await expect(redirectIfAuthenticated()).rejects.toThrow(
                'REDIRECT:{"to":"/dashboard"}'
            );
        });
    });
});
