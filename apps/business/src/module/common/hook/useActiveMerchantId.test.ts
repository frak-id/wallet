import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockParams = vi.fn();
vi.mock("@tanstack/react-router", () => ({
    useParams: (...args: unknown[]) => mockParams(...args),
}));

import {
    useActiveMerchantId,
    useOptionalActiveMerchantId,
} from "./useActiveMerchantId";

describe("useActiveMerchantId", () => {
    it("returns the merchantId from route params", () => {
        // Strict variant pulls `merchantId` from
        // `_restricted/m/$merchantId` typed params.
        mockParams.mockReturnValue({ merchantId: "merchant-42" });
        const { result } = renderHook(() => useActiveMerchantId());
        expect(result.current).toBe("merchant-42");
    });
});

describe("useOptionalActiveMerchantId", () => {
    it("returns the merchantId when present", () => {
        mockParams.mockReturnValue({ merchantId: "merchant-7" });
        const { result } = renderHook(() => useOptionalActiveMerchantId());
        expect(result.current).toBe("merchant-7");
    });

    it("returns undefined when no merchant is in scope", () => {
        mockParams.mockReturnValue({});
        const { result } = renderHook(() => useOptionalActiveMerchantId());
        expect(result.current).toBeUndefined();
    });
});
