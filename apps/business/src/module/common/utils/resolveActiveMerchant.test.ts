import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeMerchantStore } from "@/stores/activeMerchantStore";
import { resolveActiveMerchant } from "./resolveActiveMerchant";

vi.mock("@/config/auth", () => ({
    isDemoMode: () => false,
}));

const ensureQueryData = vi.fn();
vi.mock("@/module/common/provider/RootProvider", () => ({
    queryClient: {
        ensureQueryData: (...args: unknown[]) => ensureQueryData(...args),
    },
}));

const owned = [{ id: "own-1", name: "Own One", domain: "own1.example" }];
const readOnly = [
    { id: "ro-1", name: "Read Only One", domain: "ro1.example" },
    { id: "ro-2", name: "Read Only Two", domain: "ro2.example" },
];

describe("resolveActiveMerchant", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        activeMerchantStore.setState({ lastMerchantId: null });
    });

    it("prefers an owned merchant over read-only ones", async () => {
        ensureQueryData.mockResolvedValue({
            owned,
            adminOf: [],
            isPlatformAdmin: true,
            allMerchants: [...owned, ...readOnly],
        });

        const result = await resolveActiveMerchant();

        expect(result).toEqual({ status: "ok", merchant: owned[0] });
    });

    it("falls back to a read-only merchant for a platform admin with none of their own", async () => {
        ensureQueryData.mockResolvedValue({
            owned: [],
            adminOf: [],
            isPlatformAdmin: true,
            allMerchants: readOnly,
        });

        const result = await resolveActiveMerchant();

        expect(result).toEqual({ status: "ok", merchant: readOnly[0] });
    });

    it("honors a remembered read-only merchant", async () => {
        activeMerchantStore.setState({ lastMerchantId: "ro-2" });
        ensureQueryData.mockResolvedValue({
            owned: [],
            adminOf: [],
            isPlatformAdmin: true,
            allMerchants: readOnly,
        });

        const result = await resolveActiveMerchant();

        expect(result).toEqual({ status: "ok", merchant: readOnly[1] });
    });

    it("reports empty when there is no merchant at all", async () => {
        ensureQueryData.mockResolvedValue({
            owned: [],
            adminOf: [],
            isPlatformAdmin: false,
        });

        const result = await resolveActiveMerchant();

        expect(result).toEqual({ status: "empty" });
    });
});
