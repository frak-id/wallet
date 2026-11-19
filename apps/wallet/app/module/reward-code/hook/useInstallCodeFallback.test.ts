import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { useInstallCodeFallback } from "./useInstallCodeFallback";

const { mockResolveAsync, mockExecutePendingActions, mockUseResolve } =
    vi.hoisted(() => ({
        mockResolveAsync: vi.fn(),
        mockExecutePendingActions: vi.fn(),
        mockUseResolve: vi.fn(),
    }));

vi.mock("@/module/reward-code/hook/useResolveInstallCode", () => ({
    useResolveInstallCode: (options: unknown) => {
        mockUseResolve(options);
        return { resolveAsync: mockResolveAsync };
    },
}));

vi.mock("@/module/pending-actions/hook/useExecutePendingActions", () => ({
    useExecutePendingActions: () => ({
        executePendingActions: mockExecutePendingActions,
    }),
}));

const merchant = { name: "Acme", domain: "acme.test" };

function renderFallback() {
    const onResolved = vi.fn();
    const { result } = renderHook(() => useInstallCodeFallback(onResolved));
    return { fallback: result.current, onResolved };
}

describe("useInstallCodeFallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("resolves from the referral field surface", () => {
        renderFallback();
        expect(mockUseResolve).toHaveBeenCalledWith({
            surface: "referral_code",
        });
    });

    test("a resolved install code drains its ensure and is handled", async () => {
        mockResolveAsync.mockResolvedValue({
            merchantId: "merchant-1",
            merchant,
            ticket: "ticket-1",
        });
        const { fallback, onResolved } = renderFallback();

        await expect(fallback("ABC234")).resolves.toBe("handled");
        expect(mockResolveAsync).toHaveBeenCalledWith("ABC234");
        expect(mockExecutePendingActions).toHaveBeenCalledWith({
            skipNavigation: true,
        });
        expect(onResolved).toHaveBeenCalledWith(merchant);
    });

    test("an UNRESOLVED install code shows the reward-code message", async () => {
        mockResolveAsync.mockResolvedValue({
            merchantId: "merchant-1",
            merchant,
            outcome: "UNRESOLVED",
        });
        const { fallback, onResolved } = renderFallback();

        await expect(fallback("ABC234")).resolves.toEqual({
            errorKey: "rewardCode.error.unresolved",
        });
        expect(mockExecutePendingActions).not.toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
    });

    test("a code that is no install code either stays unknown", async () => {
        mockResolveAsync.mockRejectedValue({
            status: 404,
            value: { code: "CODE_NOT_FOUND" },
        });
        const { fallback, onResolved } = renderFallback();

        await expect(fallback("ABC234")).resolves.toBe("unknown");
        expect(mockExecutePendingActions).not.toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
    });
});
