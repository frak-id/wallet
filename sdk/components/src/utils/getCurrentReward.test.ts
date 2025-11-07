import type {
    GetProductInformationReturnType,
    TokenAmountType,
} from "@frak-labs/core-sdk";
import * as coreSdk from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentReward } from "./getCurrentReward";

describe("getCurrentReward", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return undefined when client is not ready", async () => {
        window.FrakSetup.client = undefined;

        const result = await getCurrentReward({});

        expect(result).toBeUndefined();
        expect(coreSdkActions.getProductInformation).not.toHaveBeenCalled();
    });

    it("should return undefined when maxReferrer is not available", async () => {
        const mockResponse: GetProductInformationReturnType = {
            id: "0x123" as `0x${string}`,
            onChainMetadata: {
                name: "Test",
                domain: "test.com",
                productTypes: [],
            },
            maxReferrer: undefined,
            rewards: [],
        };
        vi.mocked(coreSdkActions.getProductInformation).mockResolvedValue(
            mockResponse
        );

        const result = await getCurrentReward({});

        expect(result).toBeUndefined();
    });

    it("should return formatted reward from maxReferrer", async () => {
        const mockMaxReferrer: TokenAmountType = {
            amount: 10,
            eurAmount: 10,
            usdAmount: 11,
            gbpAmount: 9,
        };
        const mockResponse: GetProductInformationReturnType = {
            id: "0x123" as `0x${string}`,
            onChainMetadata: {
                name: "Test",
                domain: "test.com",
                productTypes: [],
            },
            maxReferrer: mockMaxReferrer,
            rewards: [],
        };
        vi.mocked(coreSdkActions.getProductInformation).mockResolvedValue(
            mockResponse
        );
        vi.mocked(coreSdk.getCurrencyAmountKey).mockReturnValue("eurAmount");
        vi.mocked(coreSdk.formatAmount).mockReturnValue("10 eur");

        const result = await getCurrentReward({});

        expect(result).toBe("10 eur");
        expect(coreSdk.getCurrencyAmountKey).toHaveBeenCalledWith("eur");
        expect(coreSdk.formatAmount).toHaveBeenCalledWith(10, "eur");
    });

    it("should use targetInteraction to find max reward", async () => {
        const mockMaxReferrer: TokenAmountType = {
            amount: 10,
            eurAmount: 10,
            usdAmount: 11,
            gbpAmount: 9,
        };
        const mockResponse: GetProductInformationReturnType = {
            id: "0x123" as `0x${string}`,
            onChainMetadata: {
                name: "Test",
                domain: "test.com",
                productTypes: [],
            },
            maxReferrer: mockMaxReferrer,
            rewards: [
                {
                    token: "0x111" as `0x${string}`,
                    campaign: "0x222" as `0x${string}`,
                    interactionTypeKey: "retail.customerMeeting",
                    referrer: {
                        amount: 15,
                        eurAmount: 15,
                        usdAmount: 16,
                        gbpAmount: 14,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 5,
                        usdAmount: 6,
                        gbpAmount: 4,
                    },
                },
                {
                    token: "0x111" as `0x${string}`,
                    campaign: "0x222" as `0x${string}`,
                    interactionTypeKey: "retail.customerMeeting",
                    referrer: {
                        amount: 12,
                        eurAmount: 12,
                        usdAmount: 13,
                        gbpAmount: 11,
                    },
                    referee: {
                        amount: 4,
                        eurAmount: 4,
                        usdAmount: 5,
                        gbpAmount: 3,
                    },
                },
            ],
        };
        vi.mocked(coreSdkActions.getProductInformation).mockResolvedValue(
            mockResponse
        );
        vi.mocked(coreSdk.getCurrencyAmountKey).mockReturnValue("eurAmount");
        vi.mocked(coreSdk.formatAmount).mockReturnValue("15 eur");

        const result = await getCurrentReward({
            targetInteraction: "retail.customerMeeting",
        });

        expect(result).toBe("15 eur");
        expect(coreSdk.formatAmount).toHaveBeenCalledWith(15, "eur");
    });

    it("should use maxReferrer when targetInteraction reward is 0", async () => {
        const mockMaxReferrer: TokenAmountType = {
            amount: 10,
            eurAmount: 10,
            usdAmount: 11,
            gbpAmount: 9,
        };
        const mockResponse: GetProductInformationReturnType = {
            id: "0x123" as `0x${string}`,
            onChainMetadata: {
                name: "Test",
                domain: "test.com",
                productTypes: [],
            },
            maxReferrer: mockMaxReferrer,
            rewards: [
                {
                    token: "0x111" as `0x${string}`,
                    campaign: "0x222" as `0x${string}`,
                    interactionTypeKey: "retail.customerMeeting",
                    referrer: {
                        amount: 0,
                        eurAmount: 0,
                        usdAmount: 0,
                        gbpAmount: 0,
                    },
                    referee: {
                        amount: 0,
                        eurAmount: 0,
                        usdAmount: 0,
                        gbpAmount: 0,
                    },
                },
            ],
        };
        vi.mocked(coreSdkActions.getProductInformation).mockResolvedValue(
            mockResponse
        );
        vi.mocked(coreSdk.getCurrencyAmountKey).mockReturnValue("eurAmount");
        vi.mocked(coreSdk.formatAmount).mockReturnValue("10 eur");

        const result = await getCurrentReward({
            targetInteraction: "retail.customerMeeting",
        });

        expect(result).toBe("10 eur");
        expect(coreSdk.formatAmount).toHaveBeenCalledWith(10, "eur");
    });

    it("should use custom currency from client config", async () => {
        window.FrakSetup.client = {
            config: {
                metadata: {
                    currency: "usd",
                },
            },
        } as unknown as typeof window.FrakSetup.client;

        const mockMaxReferrer: TokenAmountType = {
            amount: 20,
            eurAmount: 18,
            usdAmount: 20,
            gbpAmount: 16,
        };
        const mockResponse: GetProductInformationReturnType = {
            id: "0x123" as `0x${string}`,
            onChainMetadata: {
                name: "Test",
                domain: "test.com",
                productTypes: [],
            },
            maxReferrer: mockMaxReferrer,
            rewards: [],
        };
        vi.mocked(coreSdkActions.getProductInformation).mockResolvedValue(
            mockResponse
        );
        vi.mocked(coreSdk.getCurrencyAmountKey).mockReturnValue("usdAmount");
        vi.mocked(coreSdk.formatAmount).mockReturnValue("20 usd");

        const result = await getCurrentReward({});

        expect(result).toBe("20 usd");
        expect(coreSdk.getCurrencyAmountKey).toHaveBeenCalledWith("usd");
        expect(coreSdk.formatAmount).toHaveBeenCalledWith(20, "usd");
    });
});
