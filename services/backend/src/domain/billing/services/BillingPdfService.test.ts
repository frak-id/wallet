import { describe, expect, it } from "vitest";
import {
    type BillingPdfDocumentDto,
    BillingPdfService,
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
});
