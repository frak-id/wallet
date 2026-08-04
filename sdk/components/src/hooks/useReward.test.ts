import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReward } from "./useReward";

// Sequential: tests share vi.mock state (getMerchantInformation) and
// window.FrakSetup.client, incompatible with concurrent execution.
describe.sequential("useReward", () => {
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
                    name: "Campaign 1",
                    conditions: [],
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
            expect(result.current.reward).toContain("10");
        });
    });

    it("should filter rewards by targetInteraction", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
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
                    name: "Campaign 2",
                    conditions: [],
                    interactionTypeKey: "referral",
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
            expect(result.current.reward).toContain("15");
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
                    name: "Campaign 1",
                    conditions: [],
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

    it("should treat a percentage reward as no reward", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "percentage",
                        percent: 10,
                        percentOf: "purchase_amount",
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalled();
        });

        // Percentage rewards carry no concrete amount → reward stays undefined
        expect(result.current.reward).toBeUndefined();
    });

    it("should format the referee reward when audience is 'referee'", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 50,
                            eurAmount: 50,
                            usdAmount: 55,
                            gbpAmount: 45,
                        },
                    },
                    referee: {
                        payoutType: "fixed",
                        amount: {
                            amount: 7,
                            eurAmount: 7,
                            usdAmount: 8,
                            gbpAmount: 6,
                        },
                    },
                },
            ],
        });

        const { result } = renderHook(() =>
            useReward(true, undefined, "referee")
        );

        await waitFor(() => {
            expect(result.current.reward).toContain("7");
        });
    });

    it("should refetch when targetInteraction changes", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
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

    it("should NOT refetch when re-rendered with the same `products` array reference", async () => {
        // The effect lists `products` in its dep array, so a fresh array each
        // render would hammer `getMerchantInformation`. Components guarantee a
        // stable reference by sanitizing inside a `useMemo`.
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
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

        const stableProducts = [{ sku: "SHOE-42" }];
        const { rerender } = renderHook(() =>
            useReward(true, undefined, undefined, stableProducts)
        );

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalledTimes(1);
        });

        // Same array reference — must not trigger a second fetch.
        rerender();
        rerender();

        // No `waitFor`: asserting the absence of a call, so let any errant
        // effect fire first.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(getMerchantInformation).toHaveBeenCalledTimes(1);
    });

    it("should refetch when given a new `products` array reference with different content", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "c1",
                    name: "Campaign 1",
                    conditions: [],
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

        type Props = { products?: { sku: string }[] };
        const { rerender } = renderHook(
            (props: Props) =>
                useReward(true, undefined, undefined, props.products),
            { initialProps: { products: [{ sku: "SHOE-42" }] } as Props }
        );

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalledTimes(1);
        });

        rerender({ products: [{ sku: "OTHER-SKU" }] });

        await waitFor(() => {
            expect(getMerchantInformation).toHaveBeenCalledTimes(2);
        });
    });

    it("should prefer a matching-productScope campaign when a single-element products array is provided", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "rich-nonmatching",
                    name: "Rich, wrong product",
                    conditions: [],
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 50,
                            eurAmount: 50,
                            usdAmount: 55,
                            gbpAmount: 45,
                        },
                    },
                },
                {
                    campaignId: "poor-matching",
                    name: "Poor, right product",
                    conditions: [],
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                    interactionTypeKey: "purchase",
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

        const { result } = renderHook(() =>
            useReward(true, undefined, undefined, [{ sku: "SHOE-42" }])
        );

        await waitFor(() => {
            expect(result.current.reward).toContain("5");
        });
    });

    it("should match when ANY product in a multi-product array matches the campaign's scope", async () => {
        vi.mocked(getMerchantInformation).mockResolvedValue({
            id: "merchant-1",
            onChainMetadata: { name: "Test", domain: "test.com" },
            rewards: [
                {
                    campaignId: "rich-nonmatching",
                    name: "Rich, matches nothing in the basket",
                    conditions: [],
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                    interactionTypeKey: "purchase",
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 50,
                            eurAmount: 50,
                            usdAmount: 55,
                            gbpAmount: 45,
                        },
                    },
                },
                {
                    campaignId: "poor-matching",
                    name: "Poor, matches the second basket item",
                    conditions: [],
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                    interactionTypeKey: "purchase",
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

        // Only the second item matches the poorer campaign's scope; any-match
        // must still prefer it over the richer non-matching campaign.
        const { result } = renderHook(() =>
            useReward(true, undefined, undefined, [
                { sku: "HAT-01" },
                { sku: "SHOE-42" },
            ])
        );

        await waitFor(() => {
            expect(result.current.reward).toContain("5");
        });
    });
});
