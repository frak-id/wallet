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
const mockGetAuthToken = vi.fn();
const mockIsDemoMode = vi.fn();
const mockGetWallet = vi.fn();

vi.mock("@/stores/authStore", () => ({
    useAuthStore: {
        getState: mockGetState,
    },
}));

vi.mock("@/context/auth/authEnv", () => ({
    getAuthToken: mockGetAuthToken,
    isDemoMode: mockIsDemoMode,
    getWallet: mockGetWallet,
}));

describe("middleware/auth", () => {
    describe("requireAuth", () => {
        test("should return session when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { requireAuth } = await import("./auth");

            // Mock isomorphic functions
            mockGetAuthToken.mockReturnValue("mock-token");
            mockIsDemoMode.mockReturnValue(false);
            mockGetWallet.mockResolvedValue(mockAuthSession.wallet);

            // Mock client-side auth state for expiration check
            mockGetState.mockReturnValue({
                isAuthenticated: () => true,
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

            // Mock no auth
            mockGetAuthToken.mockReturnValue(null);
            mockIsDemoMode.mockReturnValue(false);

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

            mockGetAuthToken.mockReturnValue(null);
            mockIsDemoMode.mockReturnValue(false);

            try {
                await requireAuth({
                    location: { href: "/protected/page" },
                });
            } catch (error) {
                expect(String(error)).toContain("/protected/page");
            }
        });

        test("should allow access in demo mode", async ({
            mockAuthSession,
        }: TestContext) => {
            const { requireAuth } = await import("./auth");

            // Mock demo mode
            mockGetAuthToken.mockReturnValue("demo-token");
            mockIsDemoMode.mockReturnValue(true);
            mockGetWallet.mockResolvedValue(mockAuthSession.wallet);

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

            mockGetAuthToken.mockReturnValue(null);
            mockIsDemoMode.mockReturnValue(false);

            expect(redirectIfAuthenticated()).toBeUndefined();
        });

        test("should redirect to dashboard when user is authenticated", async () => {
            const { redirectIfAuthenticated } = await import("./auth");

            mockGetAuthToken.mockReturnValue("mock-token");
            mockIsDemoMode.mockReturnValue(false);
            mockGetState.mockReturnValue({
                isAuthenticated: () => true,
            });

            expect(() => redirectIfAuthenticated()).toThrowError(
                'REDIRECT:{"to":"/dashboard"}'
            );
        });
    });
});
