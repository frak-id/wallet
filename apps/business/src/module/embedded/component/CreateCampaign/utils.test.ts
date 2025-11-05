import { describe, expect, test } from "vitest";
import { createCampaignDraft, extractSearchParams } from "./utils";

describe("CreateCampaign utils", () => {
    describe("extractSearchParams", () => {
        describe("successful parsing", () => {
            test("should extract params with weekly budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    cac: "10",
                    r: "50",
                    wb: "1000",
                });

                expect(result).toEqual({
                    name: "Test Campaign",
                    bankId: "0x1234567890123456789012345678901234567890",
                    domain: "example.com",
                    budget: {
                        type: "weekly",
                        maxEuroDaily: 1000,
                    },
                    cacBrut: 10,
                    ratio: 50,
                    productId: expect.any(String),
                    setupCurrency: undefined,
                });
            });

            test("should extract params with monthly budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    cac: "15",
                    r: "60",
                    mb: "5000",
                });

                expect(result.budget).toEqual({
                    type: "monthly",
                    maxEuroDaily: 5000,
                });
            });

            test("should extract params with global budget", () => {
                const result = extractSearchParams({
                    n: "Test Campaign",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    cac: "20",
                    r: "70",
                    gb: "10000",
                });

                expect(result.budget).toEqual({
                    type: "global",
                    maxEuroDaily: 10000,
                });
            });

            test("should extract params with setup currency (eur)", () => {
                const result = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
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
                    cac: "10",
                    r: "50",
                    wb: "1000",
                    sc: "raw",
                });

                expect(result.setupCurrency).toBe("raw");
            });

            test("should remove www. prefix from domain when computing productId", () => {
                const resultWithWww = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "www.example.com",
                    cac: "10",
                    r: "50",
                    wb: "1000",
                });

                const resultWithoutWww = extractSearchParams({
                    n: "Test",
                    bid: "0x1234567890123456789012345678901234567890",
                    d: "example.com",
                    cac: "10",
                    r: "50",
                    wb: "1000",
                });

                expect(resultWithWww.productId).toBe(
                    resultWithoutWww.productId
                );
            });
        });

        describe("validation errors", () => {
            test("should throw error when name is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        cac: "10",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when bankId is missing", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "",
                        d: "example.com",
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
                        cac: "10",
                        r: "",
                        wb: "1000",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when bankId is invalid", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "invalid-address",
                        d: "example.com",
                        cac: "10",
                        r: "50",
                        wb: "1000",
                    })
                ).toThrow("Invalid bank id");
            });

            test("should throw error when cacBrut is not a number", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
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
                        cac: "10",
                        r: "50",
                    })
                ).toThrow("Missing required parameters");
            });

            test("should throw error when multiple budgets are provided", () => {
                expect(() =>
                    extractSearchParams({
                        n: "Test",
                        bid: "0x1234567890123456789012345678901234567890",
                        d: "example.com",
                        cac: "10",
                        r: "50",
                        wb: "1000",
                        mb: "5000",
                    })
                ).toThrow("Only one budget can be provided");
            });
        });
    });

    describe("createCampaignDraft", () => {
        test("should create campaign draft with weekly budget", () => {
            const campaign = createCampaignDraft({
                name: "Test Campaign",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: {
                    type: "weekly",
                    maxEuroDaily: 1000,
                },
                cacBrut: 10,
                ratio: 50,
            });

            expect(campaign).toEqual({
                title: "Test Campaign",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                type: "sales",
                specialCategories: [],
                budget: {
                    type: "weekly",
                    maxEuroDaily: 1000,
                },
                territories: ["FR", "BE", "SH", "GB", "US"],
                bank: "0x1234567890123456789012345678901234567890",
                scheduled: {
                    dateStart: expect.any(Date),
                },
                rewardChaining: {
                    userPercent: 0.5,
                },
                triggers: {
                    started: {
                        cac: 10,
                    },
                },
                setupCurrency: "raw",
            });
        });

        test("should create campaign draft with monthly budget", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: {
                    type: "monthly",
                    maxEuroDaily: 5000,
                },
                cacBrut: 15,
                ratio: 60,
            });

            expect(campaign.budget.type).toBe("monthly");
            expect(campaign.rewardChaining?.userPercent).toBe(0.4);
        });

        test("should create campaign draft with global budget", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: {
                    type: "global",
                    maxEuroDaily: 10000,
                },
                cacBrut: 20,
                ratio: 70,
            });

            expect(campaign.budget.type).toBe("global");
            expect(campaign.rewardChaining?.userPercent).toBeCloseTo(0.3);
        });

        test("should use custom setupCurrency when provided", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: {
                    type: "weekly",
                    maxEuroDaily: 1000,
                },
                cacBrut: 10,
                ratio: 50,
                setupCurrency: "eur",
            });

            expect(campaign.setupCurrency).toBe("eur");
        });

        test("should default setupCurrency to raw when not provided", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: {
                    type: "weekly",
                    maxEuroDaily: 1000,
                },
                cacBrut: 10,
                ratio: 50,
            });

            expect(campaign.setupCurrency).toBe("raw");
        });

        test("should calculate userPercent correctly", () => {
            const campaign1 = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: { type: "weekly", maxEuroDaily: 1000 },
                cacBrut: 10,
                ratio: 0,
            });
            expect(campaign1.rewardChaining?.userPercent).toBe(1);

            const campaign2 = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: { type: "weekly", maxEuroDaily: 1000 },
                cacBrut: 10,
                ratio: 100,
            });
            expect(campaign2.rewardChaining?.userPercent).toBe(0);
        });

        test("should always set type to sales", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: { type: "weekly", maxEuroDaily: 1000 },
                cacBrut: 10,
                ratio: 50,
            });

            expect(campaign.type).toBe("sales");
        });

        test("should set correct territories", () => {
            const campaign = createCampaignDraft({
                name: "Test",
                bankId: "0x1234567890123456789012345678901234567890",
                productId:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                budget: { type: "weekly", maxEuroDaily: 1000 },
                cacBrut: 10,
                ratio: 50,
            });

            expect(campaign.territories).toEqual([
                "FR",
                "BE",
                "SH",
                "GB",
                "US",
            ]);
        });
    });
});
