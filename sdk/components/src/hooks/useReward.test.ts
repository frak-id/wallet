import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReward } from "./useReward";

describe("useReward", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return undefined reward initially", () => {
        const { result } = renderHook(() => useReward(false, undefined));

        expect(result.current.reward).toBeUndefined();
    });

    it("should not fetch reward when shouldUseReward is false", () => {
        renderHook(() => useReward(false, undefined));

        expect(getMerchantInformation).not.toHaveBeenCalled();
    });

    it("should fetch and format a fixed reward", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 10,
                            eurAmount: 10,
                            usdAmount: 11,
                            gbpAmount: 9,
                        },
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(result.current.reward).toBe("10 eur");
        });
    });

    it("should filter rewards by targetInteraction", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 15,
                            eurAmount: 15,
                            usdAmount: 16,
                            gbpAmount: 13,
                        },
                    },
                },
                {
                    campaignId: "c2",
                    interactionTypeKey: "sharing",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 5,
                            eurAmount: 5,
                            usdAmount: 6,
                            gbpAmount: 4,
                        },
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReward(true, "purchase"));

        await waitFor(() => {
            expect(result.current.reward).toBe("15 eur");
        });
    });

    it("should return undefined when no referrer rewards exist", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [],
        });

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalled();
        });

        expect(result.current.reward).toBeUndefined();
    });

    it("should handle undefined reward response gracefully", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    interactionTypeKey: "purchase",
                    // No referrer reward — only referee
                    referee: {
                        payoutType: "fixed",
                        amount: {
                            amount: 10,
                            eurAmount: 10,
                            usdAmount: 11,
                            gbpAmount: 9,
                        },
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalled();
        });

        // No referrer rewards → reward stays undefined
        expect(result.current.reward).toBeUndefined();
    });

    it("should refetch when targetInteraction changes", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 10,
                            eurAmount: 10,
                            usdAmount: 11,
                            gbpAmount: 9,
                        },
                    },
                },
            ],
        });

        type Props = { targetInteraction?: InteractionTypeKey };
        const { rerender } = renderHook(
            (props: Props) => useReward(true, props.targetInteraction),
            {
                initialProps: { targetInteraction: undefined } as Props,
            }
        );

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalledTimes(1);
        });

        rerender({ targetInteraction: "purchase" });

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalledTimes(2);
        });
    });
});
