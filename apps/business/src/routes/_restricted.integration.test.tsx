import { describe, expect, it, vi } from "vitest";

vi.mock("@/middleware/auth", () => ({
    requireAuth: vi.fn(async () => ({ session: { user: "test" } })),
}));

describe("Restricted Layout Integration Tests", () => {
    it("should verify authentication is required at layout level", async () => {
        const { Route: RestrictedRoute } = await import("./_restricted");

        // Verify beforeLoad is defined
        expect(RestrictedRoute.options.beforeLoad).toBeDefined();

        // Verify it's the requireAuth function
        const { requireAuth } = await import("@/middleware/auth");
        expect(RestrictedRoute.options.beforeLoad).toBe(requireAuth);
    });

    it("should verify layout route configuration", async () => {
        const { Route: RestrictedRoute } = await import("./_restricted");

        // Verify route has options
        expect(RestrictedRoute.options).toBeDefined();
        expect(RestrictedRoute.options.beforeLoad).toBeDefined();
        expect(RestrictedRoute.options.component).toBeDefined();
    });

    it("should verify layout route has component defined", async () => {
        const { Route: RestrictedRoute } = await import("./_restricted");

        // Verify component is defined
        expect(RestrictedRoute.options.component).toBeDefined();
        expect(typeof RestrictedRoute.options.component).toBe("function");
    });
});
