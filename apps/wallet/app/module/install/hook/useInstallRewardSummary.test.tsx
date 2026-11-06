/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useInstallRewardSummary } from "@/module/install/hook/useInstallRewardSummary";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const { mockRewardsSummary } = vi.hoisted(() => ({
    mockRewardsSummary: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            merchant: { "rewards-summary": { get: mockRewardsSummary } },
        },
    },
}));

const ids = {
    merchantId: "11111111-1111-1111-1111-111111111111",
    anonymousId: "22222222-2222-2222-2222-222222222222",
    proof: "proof",
};
const fiat = { eurAmount: 12.5, usdAmount: 14, gbpAmount: 10.6 };
const none = { eurAmount: 0, usdAmount: 0, gbpAmount: 0 };

function summaryResponse() {
    return {
        data: {
            linked: false,
            pending: {
                total: fiat,
                cashback: fiat,
                fromFriends: none,
                count: 1,
                lockedCount: 0,
                nextUnlockAt: null,
                expiresAt: null,
            },
            earned: null,
        },
        error: null,
    };
}

describe("useInstallRewardSummary", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    test("picks and formats the amount in the merchant currency", async ({
        queryWrapper,
    }) => {
        mockRewardsSummary.mockResolvedValue(summaryResponse());

        const { result } = renderHook(
            () => useInstallRewardSummary({ ...ids, currency: "usd" }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.pendingReward).toBeDefined());
        expect(result.current.pendingReward?.amount).toContain("14");
        expect(result.current.pendingReward?.amount).toContain("$");
    });

    test("defaults to euros without a merchant currency", async ({
        queryWrapper,
    }) => {
        mockRewardsSummary.mockResolvedValue(summaryResponse());

        const { result } = renderHook(() => useInstallRewardSummary(ids), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.pendingReward).toBeDefined());
        expect(result.current.pendingReward?.amount).toContain("12");
        expect(result.current.pendingReward?.amount).toContain("€");
    });

    test("stays loading while the merchant currency is unknown", async ({
        queryWrapper,
    }) => {
        mockRewardsSummary.mockResolvedValue(summaryResponse());

        const { result } = renderHook(
            () => useInstallRewardSummary({ ...ids, currencyLoading: true }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.pendingReward).toBeDefined());
        expect(result.current.isLoading).toBe(true);
    });

    test("settles without a reward when the request stalls", async ({
        queryWrapper,
    }) => {
        mockRewardsSummary.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useInstallRewardSummary(ids), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.isLoading).toBe(false), {
            timeout: 3000,
        });
        expect(result.current.pendingReward).toBeUndefined();
    });
});
