import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
    type BillingPdfDocumentDto,
    BillingPdfService,
} from "../src/domain/billing/services/pdf";

/**
 * Renders one fake-data PDF per billing document type into `docs/previews/`.
 * Pure rendering: no database, no storage, no network, no real customer data.
 *
 *   bun run --cwd services/backend previews:billing
 *
 * Figures are coherent: 1 200 = 200 TVA + 200 Frak fees + 100 distributed
 * + 700 available.
 */
const OUT_DIR = join(import.meta.dir, "../../../docs/previews");

const buyer = {
    companyName: "Maison Exemple SAS",
    vatNumber: "FR00000000000",
    addressLines: ["12 rue de l'Exemple", "75000 Paris, France"],
};

const deposit: BillingPdfDocumentDto = {
    kind: "deposit",
    reference: "DEP-2026-0042",
    documentDate: new Date("2026-09-15T00:00:00Z"),
    currency: "eure",
    grossAmount: "1200",
    netAmount: "800",
    buyer,
    deposit: {
        vatAmount: "200",
        frakFeeAmount: "200",
        giftedAmount: "0",
        paymentPlatform: "Stripe",
        note: "Recharge du budget de récompenses (exemple)",
    },
};

const withdraw: BillingPdfDocumentDto = {
    kind: "withdraw",
    reference: "WDR-2026-0007",
    documentDate: new Date("2026-10-05T00:00:00Z"),
    currency: "eure",
    grossAmount: "400",
    netAmount: "600",
    buyer,
    withdraw: {
        remainingBankAmount: "400",
        distributedRatio: "0.5",
        restitutedVat: "100",
        restitutedFrakFee: "100",
        bankSent: "600",
        maskedIban: "FR76 **** **** **** 123",
        note: "Restitution du solde non consommé (exemple)",
    },
};

const rewardRows = [
    ...Array.from({ length: 12 }, (_, i) => ({ amount: "5", day: 3 + i })),
    ...Array.from({ length: 4 }, (_, i) => ({ amount: "10", day: 16 + i })),
].map(({ amount, day }, i) => ({
    settledAt: new Date(Date.UTC(2026, 8, day)),
    amount,
    currency: "eure",
    fiatValue: amount,
    txHash: `0x${(i + 1).toString(16).padStart(64, "0")}`,
}));

const monthlyBill: BillingPdfDocumentDto = {
    kind: "monthly_bill",
    reference: "BILL-2026-0013",
    documentDate: new Date("2026-09-30T23:59:59Z"),
    currency: "eure",
    grossAmount: "0",
    netAmount: "0",
    buyer,
    monthlyBill: {
        periodStart: new Date("2026-09-01T00:00:00Z"),
        periodEnd: new Date("2026-10-01T00:00:00Z"),
        vatApplicable: true,
        ledgers: [
            {
                currency: "eure",
                openingBalance: "800",
                closingBalance: "700",
                totalDeposited: "0",
                totalWithdrawn: "0",
                totalRewarded: "100",
                rewardedToDate: "100",
            },
        ],
        fiatTotals: { eur: "100", usd: "108", gbp: "86" },
        annexRows: rewardRows,
    },
};

const service = new BillingPdfService();
await mkdir(OUT_DIR, { recursive: true });
for (const [file, dto] of [
    ["deposit-note.pdf", deposit],
    ["withdraw-note.pdf", withdraw],
    ["monthly-bill.pdf", monthlyBill],
] as const) {
    const path = join(OUT_DIR, file);
    await writeFile(path, await service.render(dto));
    console.log(`wrote ${path}`);
}
