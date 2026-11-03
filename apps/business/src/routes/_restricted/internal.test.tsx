import { describe, expect, it, vi } from "vitest";

const { ensureQueryData } = vi.hoisted(() => ({ ensureQueryData: vi.fn() }));

vi.mock("@/module/common/provider/RootProvider", () => ({
    queryClient: { ensureQueryData },
}));

vi.mock("@/config/auth", () => ({ isDemoMode: () => false }));

import { Route } from "./internal";

const beforeLoad = Route.options.beforeLoad as () => Promise<void>;

describe("internal section guard", () => {
    it("sends anyone but a platform admin back to the dashboard", async () => {
        ensureQueryData.mockResolvedValue({ isPlatformAdmin: false });
        await expect(beforeLoad()).rejects.toMatchObject({
            options: { to: "/dashboard" },
        });
    });

    it("lets a platform admin in", async () => {
        ensureQueryData.mockResolvedValue({ isPlatformAdmin: true });
        await expect(beforeLoad()).resolves.toBeUndefined();
    });
});
