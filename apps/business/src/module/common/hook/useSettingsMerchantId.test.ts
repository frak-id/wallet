import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeMerchantStore } from "@/stores/activeMerchantStore";
import { useSettingsMerchantId } from "./useSettingsMerchantId";

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: vi.fn(),
}));

const { useMyMerchants } = await import(
    "@/module/dashboard/hooks/useMyMerchants"
);

const accessible = [
    { id: "own-1", name: "Own One" },
    { id: "own-2", name: "Own Two" },
];
const readOnly = [{ id: "ro-1", name: "Read Only" }];

function mockMerchants() {
    // Picker order: accessible first, then read-only (platform-admin view).
    vi.mocked(useMyMerchants).mockReturnValue({
        merchants: [...accessible, ...readOnly],
        accessibleMerchants: accessible,
    } as ReturnType<typeof useMyMerchants>);
}

describe("useSettingsMerchantId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        activeMerchantStore.setState({ lastMerchantId: null });
        mockMerchants();
    });

    it("honors a remembered read-only (non-accessible) merchant", () => {
        // Regression: a platform admin selecting a read-only merchant in the
        // picker must drive the settings/billing view, not snap back to the
        // first accessible merchant.
        activeMerchantStore.setState({ lastMerchantId: "ro-1" });

        const { result } = renderHook(() => useSettingsMerchantId());

        expect(result.current).toBe("ro-1");
    });

    it("uses the remembered accessible merchant when set", () => {
        activeMerchantStore.setState({ lastMerchantId: "own-2" });

        const { result } = renderHook(() => useSettingsMerchantId());

        expect(result.current).toBe("own-2");
    });

    it("falls back to the first accessible merchant when nothing is remembered", () => {
        const { result } = renderHook(() => useSettingsMerchantId());

        expect(result.current).toBe("own-1");
    });

    it("falls back to the first viewable merchant when the remembered id is gone", () => {
        activeMerchantStore.setState({ lastMerchantId: "deleted" });

        const { result } = renderHook(() => useSettingsMerchantId());

        expect(result.current).toBe("own-1");
    });
});
