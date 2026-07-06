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
});
