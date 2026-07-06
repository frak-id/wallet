import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import {
    BillingComputationService,
    stablecoinForTokenAddress,
} from "./BillingComputationService";

const service = new BillingComputationService();

describe("BillingComputationService", () => {
    describe("computeDeposit", () => {
        it("FR merchant: extracts 20% VAT from gross, fee on VAT-exclusive base", () => {
            // gross 1200 -> vat 200, feeBase 1000, frakFee 200, net 800
            const result = service.computeDeposit({
                grossAmount: "1200",
                country: "FR",
            });
            expect(result.vatAmount).toBe("200.000000000000000000");
            expect(result.frakFeeAmount).toBe("200.000000000000000000");
            expect(result.netAmount).toBe("800.000000000000000000");
        });

        it("non-FR merchant: no VAT, fee is 20% of gross", () => {
            // gross 1000 -> vat 0, frakFee 200, net 800
            const result = service.computeDeposit({
                grossAmount: "1000",
                country: "US",
            });
            expect(result.vatAmount).toBe("0.000000000000000000");
            expect(result.frakFeeAmount).toBe("200.000000000000000000");
            expect(result.netAmount).toBe("800.000000000000000000");
        });

        it("throws on negative grossAmount", () => {
            expect(() =>
                service.computeDeposit({ grossAmount: "-10", country: "FR" })
            ).toThrow();
        });

        it("throws on non-numeric grossAmount", () => {
            expect(() =>
                service.computeDeposit({
                    grossAmount: "not-a-number",
                    country: "FR",
                })
            ).toThrow();
        });

        it("throws on non-finite grossAmount", () => {
            expect(() =>
                service.computeDeposit({
                    grossAmount: "Infinity",
                    country: "FR",
                })
            ).toThrow();
        });

        it("handles zero gross", () => {
            const result = service.computeDeposit({
                grossAmount: "0",
                country: "FR",
            });
            expect(result.vatAmount).toBe("0.000000000000000000");
            expect(result.frakFeeAmount).toBe("0.000000000000000000");
            expect(result.netAmount).toBe("0.000000000000000000");
        });
    });

    describe("computeWithdraw", () => {
        it("computes pro-rata restitution when partially distributed", () => {
            // linked deposit: net 800, vat 200, frakFee 200
            // half distributed -> ratio 0.5 -> restitute half of vat/fee
            const result = service.computeWithdraw({
                remainingBankAmount: "400",
                linkedDepositNetAmount: "800",
                linkedDepositVatAmount: "200",
                linkedDepositFrakFeeAmount: "200",
                rewardsDistributedSinceDeposit: "400",
            });
            expect(result.distributedRatio).toBe("0.500000000000000000");
            expect(result.restitutedVat).toBe("100.000000000000000000");
            expect(result.restitutedFrakFee).toBe("100.000000000000000000");
            // bankSent = 400 + 100 + 100
            expect(result.bankSent).toBe("600.000000000000000000");
        });

        it("clamps ratio to 1 when distributed exceeds linked net amount", () => {
            const result = service.computeWithdraw({
                remainingBankAmount: "0",
                linkedDepositNetAmount: "800",
                linkedDepositVatAmount: "200",
                linkedDepositFrakFeeAmount: "200",
                rewardsDistributedSinceDeposit: "1600", // 2x net -> clamp to 1
            });
            expect(result.distributedRatio).toBe("1.000000000000000000");
            expect(result.restitutedVat).toBe("0.000000000000000000");
            expect(result.restitutedFrakFee).toBe("0.000000000000000000");
            expect(result.bankSent).toBe("0.000000000000000000");
        });

        it("nothing distributed: full restitution", () => {
            const result = service.computeWithdraw({
                remainingBankAmount: "800",
                linkedDepositNetAmount: "800",
                linkedDepositVatAmount: "200",
                linkedDepositFrakFeeAmount: "200",
                rewardsDistributedSinceDeposit: "0",
            });
            expect(result.distributedRatio).toBe("0.000000000000000000");
            expect(result.restitutedVat).toBe("200.000000000000000000");
            expect(result.restitutedFrakFee).toBe("200.000000000000000000");
            expect(result.bankSent).toBe("1200.000000000000000000");
        });

        it("guards divide-by-zero when linked deposit net amount is 0: treated as fully distributed, no restitution", () => {
            const result = service.computeWithdraw({
                remainingBankAmount: "50",
                linkedDepositNetAmount: "0",
                linkedDepositVatAmount: "0",
                linkedDepositFrakFeeAmount: "0",
                rewardsDistributedSinceDeposit: "0",
            });
            expect(result.distributedRatio).toBe("1.000000000000000000");
            expect(result.restitutedVat).toBe("0.000000000000000000");
            expect(result.restitutedFrakFee).toBe("0.000000000000000000");
            expect(result.bankSent).toBe("50.000000000000000000");
        });

        it("throws on negative remainingBankAmount", () => {
            expect(() =>
                service.computeWithdraw({
                    remainingBankAmount: "-5",
                    linkedDepositNetAmount: "800",
                    linkedDepositVatAmount: "200",
                    linkedDepositFrakFeeAmount: "200",
                    rewardsDistributedSinceDeposit: "0",
                })
            ).toThrow();
        });

        it("throws on negative linkedDepositNetAmount", () => {
            expect(() =>
                service.computeWithdraw({
                    remainingBankAmount: "50",
                    linkedDepositNetAmount: "-800",
                    linkedDepositVatAmount: "200",
                    linkedDepositFrakFeeAmount: "200",
                    rewardsDistributedSinceDeposit: "0",
                })
            ).toThrow();
        });

        it("throws on negative linkedDepositVatAmount", () => {
            expect(() =>
                service.computeWithdraw({
                    remainingBankAmount: "50",
                    linkedDepositNetAmount: "800",
                    linkedDepositVatAmount: "-200",
                    linkedDepositFrakFeeAmount: "200",
                    rewardsDistributedSinceDeposit: "0",
                })
            ).toThrow();
        });

        it("throws on negative linkedDepositFrakFeeAmount", () => {
            expect(() =>
                service.computeWithdraw({
                    remainingBankAmount: "50",
                    linkedDepositNetAmount: "800",
                    linkedDepositVatAmount: "200",
                    linkedDepositFrakFeeAmount: "-200",
                    rewardsDistributedSinceDeposit: "0",
                })
            ).toThrow();
        });

        it("throws on non-finite rewardsDistributedSinceDeposit", () => {
            expect(() =>
                service.computeWithdraw({
                    remainingBankAmount: "50",
                    linkedDepositNetAmount: "800",
                    linkedDepositVatAmount: "200",
                    linkedDepositFrakFeeAmount: "200",
                    rewardsDistributedSinceDeposit: "Infinity",
                })
            ).toThrow();
        });
    });

    describe("maskIban", () => {
        it("masks the middle, keeps country code and last 3 digits", () => {
            const masked = service.maskIban("FR7630006000011234567890189");
            expect(masked.startsWith("FR")).toBe(true);
            expect(masked.endsWith("189")).toBe(true);
            expect(masked).not.toContain("30006000011234567890");
        });

        it("strips spaces and uppercases before masking", () => {
            const masked = service.maskIban(
                "fr76 3000 6000 0112 3456 7890 189"
            );
            expect(masked.startsWith("FR")).toBe(true);
            expect(masked.endsWith("189")).toBe(true);
        });

        it("fully redacts input too short to safely mask", () => {
            const masked = service.maskIban("FR76");
            expect(masked).toBe("**** **** **** ****");
        });

        it("never throws on garbage input", () => {
            expect(() => service.maskIban("")).not.toThrow();
            expect(() => service.maskIban("!!!not-an-iban!!!")).not.toThrow();
        });

        it("never leaks the full value for a plausible-length non-IBAN string", () => {
            const input = "not-a-real-iban-value-12345";
            const masked = service.maskIban(input);
            expect(masked).not.toBe(input.toUpperCase());
            expect(masked).toContain("****");
        });
    });

    describe("computeMonthlyLedger", () => {
        it("folds opening + in-period movement into a closing balance", () => {
            const result = service.computeMonthlyLedger({
                depositedBefore: "1000",
                withdrawnBefore: "200",
                rewardedBefore: "100",
                depositedInPeriod: "500",
                withdrawnInPeriod: "50",
                rewardedInPeriod: "150",
            });
            // opening = 1000 - 200 - 100 = 700
            expect(result.openingBalance).toBe("700.000000000000000000");
            // closing = 700 + 500 - 50 - 150 = 1000
            expect(result.closingBalance).toBe("1000.000000000000000000");
            expect(result.totalDeposited).toBe("500.000000000000000000");
            expect(result.totalWithdrawn).toBe("50.000000000000000000");
            expect(result.totalRewarded).toBe("150.000000000000000000");
        });

        it("allows a negative balance (admin-entry-incomplete ledger, not clamped)", () => {
            const result = service.computeMonthlyLedger({
                depositedBefore: "0",
                withdrawnBefore: "0",
                rewardedBefore: "500",
                depositedInPeriod: "0",
                withdrawnInPeriod: "0",
                rewardedInPeriod: "0",
            });
            expect(result.openingBalance).toBe("-500.000000000000000000");
            expect(result.closingBalance).toBe("-500.000000000000000000");
        });
    });

    describe("assessDivergence", () => {
        it("flags when the delta exceeds both the floor and the relative threshold", () => {
            const result = service.assessDivergence("1000", "800");
            expect(result.deltaAbs).toBe("200.000000000000000000");
            expect(result.withinThreshold).toBe(false);
        });

        it("does not flag dust below the absolute floor", () => {
            const result = service.assessDivergence("1000", "999.5");
            expect(result.withinThreshold).toBe(true);
        });

        it("does not flag when within the relative percentage", () => {
            // 1% of 1000 = 10
            const result = service.assessDivergence("1000", "992");
            expect(result.withinThreshold).toBe(true);
        });

        it("is symmetric (order of derived/onChain doesn't matter)", () => {
            const a = service.assessDivergence("1000", "800");
            const b = service.assessDivergence("800", "1000");
            expect(a.deltaAbs).toBe(b.deltaAbs);
            expect(a.withinThreshold).toBe(b.withinThreshold);
        });

        it("flags against the absolute floor when derivedClosing is zero (threshold = max(1, 0) = 1)", () => {
            const result = service.assessDivergence("0", "1.5");
            expect(result.deltaAbs).toBe("1.500000000000000000");
            expect(result.withinThreshold).toBe(false);
        });

        it("uses the absolute value of a negative derivedClosing for the relative threshold", () => {
            // threshold = max(1, |-500| * 0.01) = max(1, 5) = 5; delta = 20
            const result = service.assessDivergence("-500", "-480");
            expect(result.deltaAbs).toBe("20.000000000000000000");
            expect(result.withinThreshold).toBe(false);
        });

        it("the absolute floor dominates when the relative percentage is smaller than the floor", () => {
            // threshold = max(1, |0.05| * 0.01 = 0.0005) = 1; delta = 0.505
            const result = service.assessDivergence("0.05", "0.555");
            expect(result.deltaAbs).toBe("0.505000000000000000");
            expect(result.withinThreshold).toBe(true);
        });

        it("does not flag when the delta exactly equals the threshold (lessThanOrEqualTo)", () => {
            // threshold = max(1, 1000 * 0.01) = 10; delta = 10
            const result = service.assessDivergence("1000", "990");
            expect(result.deltaAbs).toBe("10.000000000000000000");
            expect(result.withinThreshold).toBe(true);
        });
    });

    describe("annexRowFiat", () => {
        it("multiplies the token-scaled amount by each spot price", () => {
            const result = service.annexRowFiat({
                amount: "100",
                price: { eur: 0.9, usd: 1.0, gbp: 0.8 },
            });
            expect(result.eur).toBe("90.000000000000000000");
            expect(result.usd).toBe("100.000000000000000000");
            expect(result.gbp).toBe("80.000000000000000000");
        });

        it("handles a zero amount", () => {
            const result = service.annexRowFiat({
                amount: "0",
                price: { eur: 0.9, usd: 1.0, gbp: 0.8 },
            });
            expect(result.eur).toBe("0.000000000000000000");
        });
    });

    describe("stablecoinForTokenAddress", () => {
        it("maps a known stablecoin address back to its currency", () => {
            expect(stablecoinForTokenAddress(currentStablecoins.eure)).toBe(
                "eure"
            );
            expect(stablecoinForTokenAddress(currentStablecoins.usdc)).toBe(
                "usdc"
            );
        });

        it("is case-insensitive (checksum-safe address comparison)", () => {
            expect(
                stablecoinForTokenAddress(
                    currentStablecoins.eure.toLowerCase() as `0x${string}`
                )
            ).toBe("eure");
        });

        it("returns undefined for a non-stablecoin token address", () => {
            expect(
                stablecoinForTokenAddress(
                    "0x0000000000000000000000000000000000000099"
                )
            ).toBeUndefined();
        });
    });
});
