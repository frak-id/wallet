import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { useFrakBonusEligibility } from "./useFrakBonusEligibility";
import { useReferralStatus } from "./useReferralStatus";

vi.mock("./useReferralStatus", () => ({ useReferralStatus: vi.fn() }));

function mockStatus(frakReferral: { claimedMerchantIds: string[] } | null) {
    vi.mocked(useReferralStatus).mockReturnValue({
        data: { frakReferral },
    } as unknown as ReturnType<typeof useReferralStatus>);
}

describe("useFrakBonusEligibility", () => {
    test("is not eligible anywhere when the user is not Frak-referred", () => {
        mockStatus(null);
        const { result } = renderHook(() => useFrakBonusEligibility());

        expect(result.current.isFrakReferred).toBe(false);
        expect(result.current.isEligible("m1")).toBe(false);
    });

    test("is eligible on every merchant without a claimed bonus", () => {
        mockStatus({ claimedMerchantIds: ["m1"] });
        const { result } = renderHook(() => useFrakBonusEligibility());

        expect(result.current.isFrakReferred).toBe(true);
        expect(result.current.isEligible("m1")).toBe(false);
        expect(result.current.isEligible("m2")).toBe(true);
    });

    test("is not eligible while the status is loading", () => {
        vi.mocked(useReferralStatus).mockReturnValue({
            data: undefined,
        } as unknown as ReturnType<typeof useReferralStatus>);
        const { result } = renderHook(() => useFrakBonusEligibility());

        expect(result.current.isEligible("m1")).toBe(false);
    });
});
