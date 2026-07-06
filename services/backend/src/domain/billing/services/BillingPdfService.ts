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
    kind: "deposit" | "withdraw";
    reference: string;
    documentDate: Date;
    currency: string;
    grossAmount: string;
    netAmount: string;
    /** Frak, the document issuer. Defaults to `FRAK_SELLER` when omitted. */
    seller?: {
        companyName: string;
        vatNumber?: string;
        addressLines: string[];
    };
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

    constructor(
        private readonly page: PDFPage,
        private readonly font: PDFFont
    ) {
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
        const cursor = new PageCursor(page, font);

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
        const seller = dto.seller ?? FRAK_SELLER;
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
