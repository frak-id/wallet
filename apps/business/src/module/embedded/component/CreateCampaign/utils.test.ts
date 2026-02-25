import { describe, expect, test } from "vitest";
import { buildCampaignRule, extractSearchParams } from "./utils";

const mockMerchantId = "test-merchant-uuid-123";

describe("CreateCampaign utils", () => {
    describe("extractSearchParams", () => {
        describe("successful parsing", () => {
            test("should extract params with weekly budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "10",
                    r: "50",
                    wb: "1000",
                });

                expect(result).toEqual({
                    name: "Test Campaign",
                    bankId: "0x1234567890123456789012345678901234567890",
                    domain: "example.com",
                    merchantId: mockMerchantId,
                    budgetConfig: [
                        {
                            label: "weekly",
                            durationInSeconds: 7 * 24 * 60 * 60,
                            amount: 1000,
                        },
                    ],
                    cacBrut: 10,
                    ratio: 50,
                    setupCurrency: undefined,
                });
            });

            test("should extract params with monthly budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "15",
                    r: "60",
                    mb: "5000",
                });

                expect(result.budgetConfig).toEqual([
                    {
                        label: "monthly",
                        durationInSeconds: 30 * 24 * 60 * 60,
                        amount: 5000,
                    },
                ]);
            });

            test("should extract params with global budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "20",
                    r: "70",
                    gb: "10000",
                });

                expect(result.budgetConfig).toEqual([
                    {
                        label: "global",
                        durationInSeconds: null,
                        amount: 10000,
                    },
                ]);
            });

            test("should extract params with setup currency (eur)", () => {
                const result = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "10",
                    r: "50",
                    wb: "1000",
                    sc: "eur",
                });

                expect(result.setupCurrency).toBe("eur");
            });

            test("should extract params with setup currency (usd)", () => {
                const result = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "10",
                    r: "50",
                    wb: "1000",
                    sc: "usd",
                });

                expect(result.setupCurrency).toBe("usd");
            });

            test("should extract params with setup currency (gbp)", () => {
                const result = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "10",
                    r: "50",
                    wb: "1000",
                    sc: "gbp",
                });

                expect(result.setupCurrency).toBe("gbp");
            });

            test("should extract params with setup currency (raw)", () => {
                const result = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    mid: mockMerchantId,
                    cac: "10",
                    r: "50",
                    wb: "1000",
                    sc: "raw",
                });

                expect(result.setupCurrency).toBe("raw");
            });
        });

        describe("validation errors", () => {
            test("should throw error when name is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when domain is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when cacBrut is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when ratio is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when cacBrut is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "not-a-number",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Invalid cac brut");
            });

            test("should throw error when ratio is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "not-a-number",
                        wb: "1000",
                    })
                ).toThrow("Invalid ratio");
            });

            test("should throw error when setupCurrency is invalid", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        wb: "1000",
                        sc: "invalid",
                    })
                ).toThrow("Invalid setup currency");
            });

            test("should throw error when weekly budget is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        wb: "not-a-number",
                    })
                ).toThrow("Invalid weekly budget");
            });

            test("should throw error when monthly budget is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        mb: "not-a-number",
                    })
                ).toThrow("Invalid monthly budget");
            });

            test("should throw error when global budget is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        gb: "not-a-number",
                    })
                ).toThrow("Invalid global budget");
            });

            test("should throw error when no budget is provided", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                    })
                ).toThrow("Missing required budget parameters");
            });

            test("should throw error when multiple budgets are provided", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        mid: mockMerchantId,
                        cac: "10",
                        r: "50",
                        wb: "1000",
                        mb: "5000",
                    })
                ).toThrow("Only one budget can be provided");
            });
        });
    });

    describe("buildCampaignRule", () => {
        test("should build rule with 50/50 split", () => {
            const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

            expect(rule.trigger).toBe("purchase");
            expect(rule.conditions).toEqual([]);
            expect(rule.rewards).toHaveLength(2);
            expect(rule.rewards[0]).toEqual({
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 5,
                description: "Referrer reward",
            });
            expect(rule.rewards[1]).toEqual({
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 5,
                description: "Referee reward",
            });
        });

        test("should build rule with 100% referrer", () => {
            const rule = buildCampaignRule({ cacBrut: 10, ratio: 100 });

            expect(rule.rewards).toHaveLength(1);
            expect(rule.rewards[0]?.recipient).toBe("referrer");
            expect(rule.rewards[0]).toHaveProperty("amount", 10);
        });

        test("should build rule with 0% referrer (100% referee)", () => {
            const rule = buildCampaignRule({ cacBrut: 10, ratio: 0 });

            expect(rule.rewards).toHaveLength(1);
            expect(rule.rewards[0]?.recipient).toBe("referee");
            expect(rule.rewards[0]).toHaveProperty("amount", 10);
        });

        test("should handle non-round ratio splits", () => {
            const rule = buildCampaignRule({ cacBrut: 10, ratio: 70 });

            expect(rule.rewards).toHaveLength(2);
            expect(rule.rewards[0]).toHaveProperty("amount", 7);
            expect(rule.rewards[1]).toHaveProperty("amount", 3);
        });

        test("should default maxRewardsPerUser to 1", () => {
            const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

            expect(rule.maxRewardsPerUser).toBe(1);
        });
    });
});
