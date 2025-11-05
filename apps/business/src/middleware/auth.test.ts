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

vi.mock("@/context/auth/session", () => ({
    getSession: vi.fn(),
}));

describe("middleware/auth", () => {
    describe("requireAuth", () => {
        test("should return session when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { getSession } = await import("@/context/auth/session");
            const { requireAuth } = await import("./auth");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            const result = await requireAuth({
                location: { href: "/dashboard" },
            });

            expect(result).toEqual({ session: mockAuthSession });
        });

        test("should redirect to login when user is not authenticated", async () => {
            const { getSession } = await import("@/context/auth/session");
            const { requireAuth } = await import("./auth");

            vi.mocked(getSession).mockResolvedValue(null);

            await expect(
                requireAuth({
                    location: { href: "/dashboard/campaigns" },
                })
            ).rejects.toThrow(
                'REDIRECT:{"to":"/login","search":{"redirect":"/dashboard/campaigns"}}'
            );
        });

        test("should preserve redirect URL in search params", async () => {
            const { getSession } = await import("@/context/auth/session");
            const { requireAuth } = await import("./auth");

            vi.mocked(getSession).mockResolvedValue(null);

            try {
                await requireAuth({
                    location: { href: "/protected/page" },
                });
            } catch (error) {
                expect(String(error)).toContain("/protected/page");
            }
        });
    });

    describe("redirectIfAuthenticated", () => {
        test("should do nothing when user is not authenticated", async () => {
            const { getSession } = await import("@/context/auth/session");
            const { redirectIfAuthenticated } = await import("./auth");

            vi.mocked(getSession).mockResolvedValue(null);

            await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
        });

        test("should redirect to dashboard when user is authenticated", async ({
            mockAuthSession,
        }: TestContext) => {
            const { getSession } = await import("@/context/auth/session");
            const { redirectIfAuthenticated } = await import("./auth");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            await expect(redirectIfAuthenticated()).rejects.toThrow(
                'REDIRECT:{"to":"/dashboard"}'
            );
        });
    });
});
