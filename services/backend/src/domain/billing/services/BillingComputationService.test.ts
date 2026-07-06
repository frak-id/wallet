import { describe, expect, it } from "vitest";
import { BillingComputationService } from "./BillingComputationService";

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

        it("guards divide-by-zero when linked deposit net amount is 0", () => {
            const result = service.computeWithdraw({
                remainingBankAmount: "50",
                linkedDepositNetAmount: "0",
                linkedDepositVatAmount: "0",
                linkedDepositFrakFeeAmount: "0",
                rewardsDistributedSinceDeposit: "0",
            });
            expect(result.distributedRatio).toBe("0.000000000000000000");
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
});
