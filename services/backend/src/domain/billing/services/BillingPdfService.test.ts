import { describe, expect, it } from "vitest";
import {
    type BillingPdfDocumentDto,
    BillingPdfService,
    sanitizeForWinAnsi,
} from "./BillingPdfService";

const depositDto: BillingPdfDocumentDto = {
    kind: "deposit",
    reference: "DEP-2026-0001",
    documentDate: new Date("2026-01-15T00:00:00Z"),
    currency: "eure",
    grossAmount: "1200",
    netAmount: "800",
    buyer: {
        companyName: "Acme Café", // exotic-ish char (é) exercises sanitize()
        vatNumber: "FR12345678900",
        addressLines: ["1 Rue de Paris", "75001 Paris, FR"],
    },
    deposit: {
        vatAmount: "200",
        frakFeeAmount: "200",
        note: "Initial campaign refill",
        paymentPlatform: "shopify",
    },
};

const withdrawDto: BillingPdfDocumentDto = {
    kind: "withdraw",
    reference: "WDR-2026-0001",
    documentDate: new Date("2026-02-15T00:00:00Z"),
    currency: "usdc",
    grossAmount: "500",
    netAmount: "500",
    buyer: {
        companyName: "Non FR Merchant",
        addressLines: ["1 Main St", "New York, US"],
    },
    withdraw: {
        remainingBankAmount: "400",
        distributedRatio: "0.5",
        restitutedVat: "0",
        restitutedFrakFee: "100",
        bankSent: "500",
        maskedIban: "FR76 **** **** **** 123",
    },
};

const monthlyBillDto: BillingPdfDocumentDto = {
    kind: "monthly_bill",
    reference: "BILL-2026-0001",
    documentDate: new Date("2026-03-01T00:00:00Z"),
    currency: "eure",
    grossAmount: "0",
    netAmount: "0",
    buyer: {
        companyName: "Acme Café",
        addressLines: ["1 Rue de Paris", "75001 Paris, FR"],
    },
    monthlyBill: {
        periodStart: new Date("2026-02-01T00:00:00Z"),
        periodEnd: new Date("2026-03-01T00:00:00Z"),
        ledgers: [
            {
                currency: "eure",
                openingBalance: "700",
                closingBalance: "1000",
                totalDeposited: "500",
                totalWithdrawn: "50",
                totalRewarded: "150",
            },
        ],
        fiatTotals: { eur: "150", usd: "165", gbp: "130" },
        annexRows: [
            {
                settledAt: new Date("2026-02-10T00:00:00Z"),
                amount: "10",
                currency: "eure",
                fiatValue: "10",
                txHash: "0xabc123",
            },
        ],
        review: { flagged: false },
    },
};

describe("BillingPdfService", () => {
    const service = new BillingPdfService();

    it("renders a valid deposit PDF", async () => {
        const bytes = await service.render(depositDto);
        expect(bytes.length).toBeGreaterThan(0);
        const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
        expect(header).toBe("%PDF-");
    });

    it("renders a valid withdraw PDF", async () => {
        const bytes = await service.render(withdrawDto);
        expect(bytes.length).toBeGreaterThan(0);
        const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
        expect(header).toBe("%PDF-");
    });

    it("renders a valid monthly bill PDF", async () => {
        const bytes = await service.render(monthlyBillDto);
        expect(bytes.length).toBeGreaterThan(0);
        const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
        expect(header).toBe("%PDF-");
    });

    it("renders a monthly bill with a flagged review banner and no annex rows", async () => {
        const bytes = await service.render({
            ...monthlyBillDto,
            monthlyBill: {
                ...monthlyBillDto.monthlyBill,
                annexRows: [],
                review: { flagged: true },
            } as NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        });
        expect(bytes.length).toBeGreaterThan(0);
    });

    it("paginates a long reward annex without throwing", async () => {
        const manyRows = Array.from({ length: 80 }, (_, i) => ({
            settledAt: new Date("2026-02-10T00:00:00Z"),
            amount: "1",
            currency: "eure",
            fiatValue: "1",
            txHash: `0x${i.toString().padStart(4, "0")}`,
        }));
        const bytes = await service.render({
            ...monthlyBillDto,
            monthlyBill: {
                ...monthlyBillDto.monthlyBill,
                annexRows: manyRows,
            } as NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        });
        expect(bytes.length).toBeGreaterThan(0);
    });

    it("renders a deposit PDF containing a € amount without throwing", async () => {
        // The € sign (U+20AC) is a WinAnsi-1252 glyph above 0xFF; a naive
        // <= 0xFF filter would strip it and pdf-lib would still encode fine,
        // but this exercises the full render path with the sign present.
        const bytes = await service.render({
            ...depositDto,
            deposit: {
                ...depositDto.deposit,
                note: "Refill of 1 200 € — see quote…",
            } as NonNullable<BillingPdfDocumentDto["deposit"]>,
        });
        expect(bytes.length).toBeGreaterThan(0);
    });

    it("renders when the seller block is taller than the buyer block", async () => {
        // Buyer has no VAT and no address lines -> the left (seller) column is
        // taller. Regression for drawPartyBlocks resuming at the shorter
        // column's baseline and overwriting the seller block.
        const bytes = await service.render({
            ...depositDto,
            buyer: {
                companyName: "Short Buyer",
                addressLines: [],
            },
        });
        expect(bytes.length).toBeGreaterThan(0);
    });
});

describe("sanitizeForWinAnsi", () => {
    it("keeps plain ASCII unchanged", () => {
        expect(sanitizeForWinAnsi("Deposit note DEP-2026-0001")).toBe(
            "Deposit note DEP-2026-0001"
        );
    });

    it("keeps Latin-1 accented characters", () => {
        expect(sanitizeForWinAnsi("Acme Café à Paris, ça va")).toBe(
            "Acme Café à Paris, ça va"
        );
    });

    it("keeps the € sign (WinAnsi-1252 glyph above 0xFF)", () => {
        expect(sanitizeForWinAnsi("1200 €")).toBe("1200 €");
    });

    it("keeps the horizontal ellipsis and typographic dashes/quotes", () => {
        expect(sanitizeForWinAnsi("a…b—c–d‘e’f“g”")).toBe("a…b—c–d‘e’f“g”");
    });

    it("replaces non-WinAnsi code points above 0xFF with '?'", () => {
        // 😀 emoji, 你好 CJK — none are WinAnsi-encodable.
        expect(sanitizeForWinAnsi("a😀b你c")).toBe("a?b?c");
    });

    it("replaces CP-1252-undefined bytes in the 0x80-0x9F range with '?'", () => {
        // 0x81, 0x8D, 0x8F, 0x90, 0x9D have no CP-1252 glyph.
        const undefinedBytes = "\u0081\u008d\u008f\u0090\u009d";
        expect(sanitizeForWinAnsi(`a${undefinedBytes}b`)).toBe("a?????b");
    });
});
