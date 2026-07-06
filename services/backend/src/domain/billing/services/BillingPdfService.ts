import {
    PDFDocument,
    type PDFFont,
    type PDFPage,
    type RGB,
    rgb,
    StandardFonts,
} from "pdf-lib";

/**
 * Frak's own invoicing identity, printed as the "seller" block on every
 * generated deposit/withdraw document. Hardcoded for Phase 2 — becomes a
 * config value if Frak's legal entity ever needs to vary per stage/country.
 */
const FRAK_SELLER = {
    companyName: "Frak Labs",
    vatNumber: "FR00000000000",
    addressLines: ["Paris, France"],
} as const;

/**
 * Input DTO for `BillingPdfService.render`. Assembled by the orchestrator
 * (cross-domain reads happen there — this service is domain-pure and never
 * touches the DB or another domain). All money fields are the *frozen*
 * decimal strings already computed by `BillingComputationService` — this
 * service only formats them for display, it never recomputes.
 */
export type BillingPdfDocumentDto = {
    kind: "deposit" | "withdraw" | "monthly_bill";
    reference: string;
    documentDate: Date;
    currency: string;
    /** Not meaningful for `monthly_bill` (multi-currency; use `monthlyBill.ledgers`). */
    grossAmount: string;
    /** Not meaningful for `monthly_bill` (multi-currency; use `monthlyBill.ledgers`). */
    netAmount: string;
    /** The merchant being billed. May be partial/empty if accounting info was never filled in. */
    buyer: {
        companyName?: string;
        vatNumber?: string;
        addressLines: string[];
    };
    /** Present when `kind === "deposit"`. */
    deposit?: {
        vatAmount: string;
        frakFeeAmount: string;
        note?: string;
        paymentPlatform?: string;
    };
    /** Present when `kind === "withdraw"`. */
    withdraw?: {
        remainingBankAmount: string;
        distributedRatio: string;
        restitutedVat: string;
        restitutedFrakFee: string;
        bankSent: string;
        maskedIban: string;
        note?: string;
    };
    /** Present when `kind === "monthly_bill"`. */
    monthlyBill?: {
        periodStart: Date;
        periodEnd: Date;
        ledgers: Array<{
            currency: string;
            openingBalance: string;
            closingBalance: string;
            totalDeposited: string;
            totalWithdrawn: string;
            totalRewarded: string;
        }>;
        fiatTotals: { eur: string; usd: string; gbp: string };
        /** Per-line settled rewards in the period — re-queried at render time (§3.2), not stored in `details`. */
        annexRows: Array<{
            settledAt: Date;
            amount: string;
            currency: string;
            fiatValue: string;
            txHash?: string;
        }>;
        /** Present when the on-chain divergence check ran (§6.2). */
        review?: {
            flagged: boolean;
            skipped?: boolean;
            skipReason?: string;
        };
    };
};

const PAGE_WIDTH = 595.28; // A4 @ 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const DARK = rgb(0.13, 0.13, 0.13);
const GRAY = rgb(0.45, 0.45, 0.45);

/**
 * WinAnsi (Latin-1-ish) code-point range pdf-lib's StandardFonts can encode.
 * Anything outside it (emoji, CJK, exotic symbols...) is replaced with "?"
 * rather than throwing at draw time. Covers accented FR characters (é, à, ç,
 * €, …) which all sit within WinAnsi-1252.
 */
function sanitizeForWinAnsi(input: string): string {
    let out = "";
    for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0;
        out += code <= 0xff ? ch : "?";
    }
    return out;
}

/** Formats a frozen decimal string for display only (thousands + 2dp). Never used for math. */
function formatMoney(value: string, currency: string): string {
    const n = Number.parseFloat(value);
    const formatted = Number.isFinite(n)
        ? n.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })
        : value;
    return `${formatted} ${currency.toUpperCase()}`;
}

function isVatApplicable(vatAmount: string | undefined): boolean {
    if (!vatAmount) return false;
    const n = Number.parseFloat(vatAmount);
    return Number.isFinite(n) && n > 0;
}

type DrawOptions = {
    x?: number;
    size?: number;
    useFont?: PDFFont;
    color?: RGB;
};

/**
 * Small stateful cursor over a single PDF page — tracks the current `y`
 * position so callers can draw top-to-bottom without threading `y` through
 * every call. Scoped to one `render()` invocation; not shared across pages.
 */
class PageCursor {
    y: number;
    private page: PDFPage;

    constructor(
        page: PDFPage,
        private readonly font: PDFFont,
        private readonly newPage: () => PDFPage
    ) {
        this.page = page;
        this.y = PAGE_HEIGHT - MARGIN;
    }

    text(text: string, options: DrawOptions = {}): void {
        const {
            x = MARGIN,
            size = 10,
            useFont = this.font,
            color = DARK,
        } = options;
        this.page.drawText(sanitizeForWinAnsi(text), {
            x,
            y: this.y,
            size,
            font: useFont,
            color,
        });
    }

    newLine(height = 16): void {
        this.y -= height;
    }

    /**
     * Starts a fresh page if fewer than `minRemaining` points are left below
     * the bottom margin — used before drawing a table row so a row is never
     * split across pages (monthly-bill annex can be arbitrarily long).
     */
    ensureSpace(minRemaining: number): void {
        if (this.y - minRemaining < MARGIN) {
            this.page = this.newPage();
            this.y = PAGE_HEIGHT - MARGIN;
        }
    }
}

/**
 * Renders deposit/withdraw invoices to PDF bytes. Pure: given the same DTO it
 * always produces equivalent content — no DB reads, no cross-domain imports,
 * no network. The orchestrator assembles the DTO; this service only lays it
 * out on the page.
 */
export class BillingPdfService {
    async render(dto: BillingPdfDocumentDto): Promise<Uint8Array> {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const cursor = new PageCursor(page, font, () =>
            pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        );

        if (dto.kind === "monthly_bill" && dto.monthlyBill) {
            this.drawMonthlyBillHeader(cursor, dto, bold);
            this.drawPartyBlocks(cursor, dto, bold);
            this.drawMonthlyBillLedgers(cursor, dto.monthlyBill, bold);
            this.drawMonthlyBillAnnex(cursor, dto.monthlyBill, bold);
            return pdfDoc.save();
        }

        this.drawHeader(cursor, dto, bold);
        this.drawPartyBlocks(cursor, dto, bold);
        this.drawAmounts(cursor, dto, bold);

        if (dto.kind === "deposit" && dto.deposit) {
            this.drawDepositDetails(cursor, dto.deposit, dto.currency);
        }
        if (dto.kind === "withdraw" && dto.withdraw) {
            this.drawWithdrawDetails(cursor, dto.withdraw, dto.currency, bold);
        }

        return pdfDoc.save();
    }

    private drawMonthlyBillHeader(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const monthlyBill = dto.monthlyBill;
        if (!monthlyBill) return;

        cursor.text("Monthly bill", { size: 20, useFont: bold });
        cursor.newLine(28);

        cursor.text(`Reference: ${dto.reference}`, { size: 11 });
        cursor.newLine(14);
        const start = monthlyBill.periodStart.toISOString().slice(0, 10);
        const end = monthlyBill.periodEnd.toISOString().slice(0, 10);
        cursor.text(`Period: ${start} to ${end}`, { size: 11 });
        cursor.newLine(14);
        cursor.text(
            `Fiat totals: ${monthlyBill.fiatTotals.eur} EUR / ${monthlyBill.fiatTotals.usd} USD / ${monthlyBill.fiatTotals.gbp} GBP`,
            { size: 11 }
        );
        cursor.newLine(20);

        if (monthlyBill.review?.flagged) {
            cursor.text(
                "REVIEW: derived balance diverges from the on-chain balance beyond threshold — admin review required.",
                { size: 9, color: DARK }
            );
            cursor.newLine(16);
        } else if (monthlyBill.review?.skipped) {
            cursor.text(
                `On-chain divergence check skipped (${monthlyBill.review.skipReason ?? "unknown reason"}).`,
                { size: 9, color: GRAY }
            );
            cursor.newLine(16);
        }
        cursor.newLine(8);
    }

    private drawMonthlyBillLedgers(
        cursor: PageCursor,
        monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        bold: PDFFont
    ): void {
        cursor.text("Per-currency ledger", { size: 13, useFont: bold });
        cursor.newLine(20);

        for (const ledger of monthlyBill.ledgers) {
            cursor.ensureSpace(90);
            cursor.text(ledger.currency.toUpperCase(), {
                size: 11,
                useFont: bold,
            });
            cursor.newLine(15);
            cursor.text(
                `Opening: ${formatMoney(ledger.openingBalance, ledger.currency)}   Closing: ${formatMoney(ledger.closingBalance, ledger.currency)}`,
                { size: 9 }
            );
            cursor.newLine(13);
            cursor.text(
                `Deposited: ${formatMoney(ledger.totalDeposited, ledger.currency)}   Withdrawn: ${formatMoney(ledger.totalWithdrawn, ledger.currency)}   Rewarded: ${formatMoney(ledger.totalRewarded, ledger.currency)}`,
                { size: 9, color: GRAY }
            );
            cursor.newLine(20);
        }
        cursor.newLine(6);
    }

    private drawMonthlyBillAnnex(
        cursor: PageCursor,
        monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        bold: PDFFont
    ): void {
        cursor.ensureSpace(60);
        cursor.text(`Reward annex (${monthlyBill.annexRows.length} rows)`, {
            size: 13,
            useFont: bold,
        });
        cursor.newLine(18);

        if (monthlyBill.annexRows.length === 0) {
            cursor.text("No settled rewards in this period.", {
                size: 9,
                color: GRAY,
            });
            cursor.newLine(14);
            return;
        }

        cursor.text("Date", { size: 8, color: GRAY });
        cursor.text("Amount", { x: MARGIN + 110, size: 8, color: GRAY });
        cursor.text("Fiat value", { x: MARGIN + 230, size: 8, color: GRAY });
        cursor.text("Tx hash", { x: MARGIN + 340, size: 8, color: GRAY });
        cursor.newLine(13);

        for (const row of monthlyBill.annexRows) {
            cursor.ensureSpace(13);
            cursor.text(row.settledAt.toISOString().slice(0, 10), { size: 8 });
            cursor.text(formatMoney(row.amount, row.currency), {
                x: MARGIN + 110,
                size: 8,
            });
            cursor.text(row.fiatValue, { x: MARGIN + 230, size: 8 });
            cursor.text(row.txHash ?? "—", { x: MARGIN + 340, size: 7 });
            cursor.newLine(13);
        }
    }

    private drawHeader(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const title = dto.kind === "deposit" ? "Deposit note" : "Withdraw bill";
        cursor.text(title, { size: 20, useFont: bold });
        cursor.newLine(28);

        cursor.text(`Reference: ${dto.reference}`, { size: 11 });
        cursor.newLine(14);
        cursor.text(`Date: ${dto.documentDate.toISOString().slice(0, 10)}`, {
            size: 11,
        });
        cursor.newLine(14);
        cursor.text(`Currency: ${dto.currency.toUpperCase()}`, { size: 11 });
        cursor.newLine(28);
    }

    private drawPartyBlocks(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const seller = FRAK_SELLER;
        const blockTopY = cursor.y;
        const rightX = PAGE_WIDTH / 2 + 10;

        cursor.text("Issued by", { size: 9, color: GRAY });
        cursor.newLine(14);
        cursor.text(seller.companyName, { useFont: bold });
        cursor.newLine(13);
        if (seller.vatNumber) {
            cursor.text(`VAT: ${seller.vatNumber}`, { size: 9 });
            cursor.newLine(13);
        }
        for (const line of seller.addressLines) {
            cursor.text(line, { size: 9 });
            cursor.newLine(12);
        }

        // Reset y to draw the buyer block in the right column.
        cursor.y = blockTopY;
        cursor.text("Billed to", { x: rightX, size: 9, color: GRAY });
        cursor.newLine(14);
        cursor.text(dto.buyer.companyName ?? "(no company name on file)", {
            x: rightX,
            useFont: bold,
        });
        cursor.newLine(13);
        if (dto.buyer.vatNumber) {
            cursor.text(`VAT: ${dto.buyer.vatNumber}`, {
                x: rightX,
                size: 9,
            });
            cursor.newLine(13);
        }
        for (const line of dto.buyer.addressLines) {
            cursor.text(line, { x: rightX, size: 9 });
            cursor.newLine(12);
        }

        // Continue below whichever block is taller.
        cursor.y -= 20;
    }

    private drawAmounts(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        cursor.text("Amounts", { size: 13, useFont: bold });
        cursor.newLine(20);

        cursor.text(
            `Gross amount: ${formatMoney(dto.grossAmount, dto.currency)}`
        );
        cursor.newLine(15);
        cursor.text(`Net amount: ${formatMoney(dto.netAmount, dto.currency)}`);
        cursor.newLine(20);
    }

    private drawDepositDetails(
        cursor: PageCursor,
        deposit: NonNullable<BillingPdfDocumentDto["deposit"]>,
        currency: string
    ): void {
        if (isVatApplicable(deposit.vatAmount)) {
            cursor.text(
                `VAT (20%): ${formatMoney(deposit.vatAmount, currency)}`
            );
        } else {
            cursor.text("VAT: reverse-charged / not applicable", {
                color: GRAY,
            });
        }
        cursor.newLine(15);
        cursor.text(
            `Frak fee: ${formatMoney(deposit.frakFeeAmount, currency)}`
        );
        cursor.newLine(15);
        if (deposit.paymentPlatform) {
            cursor.text(`Payment platform: ${deposit.paymentPlatform}`, {
                size: 9,
                color: GRAY,
            });
            cursor.newLine(14);
        }
        if (deposit.note) {
            cursor.newLine(6);
            cursor.text(`Note: ${deposit.note}`, { size: 9 });
            cursor.newLine(14);
        }
    }

    private drawWithdrawDetails(
        cursor: PageCursor,
        withdraw: NonNullable<BillingPdfDocumentDto["withdraw"]>,
        currency: string,
        bold: PDFFont
    ): void {
        cursor.text("Restitution breakdown", { size: 12, useFont: bold });
        cursor.newLine(18);
        cursor.text(
            `Remaining bank amount: ${formatMoney(withdraw.remainingBankAmount, currency)}`
        );
        cursor.newLine(15);

        const ratioPct = (
            Number.parseFloat(withdraw.distributedRatio) * 100
        ).toFixed(2);
        cursor.text(`Distributed ratio: ${ratioPct}%`);
        cursor.newLine(15);

        if (isVatApplicable(withdraw.restitutedVat)) {
            cursor.text(
                `Restituted VAT: ${formatMoney(withdraw.restitutedVat, currency)}`
            );
        } else {
            cursor.text("Restituted VAT: reverse-charged / not applicable", {
                color: GRAY,
            });
        }
        cursor.newLine(15);
        cursor.text(
            `Restituted Frak fee: ${formatMoney(withdraw.restitutedFrakFee, currency)}`
        );
        cursor.newLine(15);
        cursor.text(
            `Total sent to destination account: ${formatMoney(withdraw.bankSent, currency)}`,
            { useFont: bold }
        );
        cursor.newLine(18);
        cursor.text(`Destination account: ${withdraw.maskedIban}`, {
            size: 10,
        });
        cursor.newLine(16);
        if (withdraw.note) {
            cursor.newLine(6);
            cursor.text(`Note: ${withdraw.note}`, { size: 9 });
            cursor.newLine(14);
        }
    }
}
