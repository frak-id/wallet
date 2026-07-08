import Decimal from "decimal.js";
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
    siren: "953585783",
    vatNumber: "FR90953585783",
    addressLines: ["40 rue Bezout", "75014 Paris, France"],
    email: "hello@frak-labs.com",
    /** Legal-form mention printed in the footer of every issued document. */
    legalForm: "Société par actions simplifiée au capital social de 4 296,00 €",
} as const;

/**
 * Stablecoin → fiat presentation. Documents are merchant-facing legal papers:
 * they show the fiat equivalent of every amount (EUR/€, GBP/£, USD/$), never
 * the crypto token symbol or on-chain address. All stablecoins are pegged 1:1
 * to their fiat leg, so a token amount is already its fiat equivalent.
 */
const FIAT_BY_STABLECOIN: Record<string, { code: string; symbol: string }> = {
    eure: { code: "EUR", symbol: "€" },
    gbpe: { code: "GBP", symbol: "£" },
    usde: { code: "USD", symbol: "$" },
    usdc: { code: "USD", symbol: "$" },
};

function fiatFor(currency: string): { code: string; symbol: string } {
    return (
        FIAT_BY_STABLECOIN[currency.toLowerCase()] ?? {
            code: currency.toUpperCase(),
            symbol: currency.toUpperCase(),
        }
    );
}

/** VAT + Frak-fee rates used for the reward-table display math (§4). */
const VAT_RATE = new Decimal("0.20");
const FRAK_FEE_RATE = new Decimal("0.20");

/**
 * Deposit-note copy. The document is an attestation that Frak received an
 * advance on advertising budget credited to the advertiser's campaign wallet —
 * explicitly NOT an invoice.
 */
const DEPOSIT_OBJET =
    "Alimentation du wallet maître Frak à utiliser pour les campagnes de récompenses client";
const DEPOSIT_ATTESTATION = [
    "Ce document atteste que Frak Labs a bien reçu les fonds mentionnés ci-dessus pour être crédités sur le wallet de campagne de l'annonceur.",
    "Ce crédit constitue une avance sur budget publicitaire, à consommer au fil des campagnes actives, et ne constitue pas une facture.",
];

/**
 * Withdraw-note copy. Symmetric to the deposit note: an attestation that Frak
 * returned the unconsumed advance to the advertiser — also NOT an invoice.
 */
const WITHDRAW_OBJET =
    "Restitution des fonds non consommés du wallet de campagne Frak";
const WITHDRAW_ATTESTATION = [
    "Ce document atteste que Frak Labs a restitué à l'annonceur les fonds non consommés mentionnés ci-dessus, initialement crédités sur son wallet de campagne.",
    "Ce remboursement correspond au solde d'avance sur budget publicitaire non consommé, et ne constitue pas une facture.",
];

/**
 * Frak brand badge, printed top-right on every generated document. The two
 * paths are the exact vectors from the design system's `LogoFrakBadge`
 * (24×24 viewBox): a `#0043EF` rounded square with the white "F" glyph on
 * top — kept in sync with the frontends' canonical app icon.
 */
const LOGO_VIEWBOX = 24;
const LOGO_BADGE_BG_PATH =
    "M6 0 H18 A6 6 0 0 1 24 6 V18 A6 6 0 0 1 18 24 H6 A6 6 0 0 1 0 18 V6 A6 6 0 0 1 6 0 Z";
const LOGO_BADGE_F_PATH =
    "M9.77 15.91L5.15 14.35C5.06 14.32 4.97 14.38 4.97 14.47V17.33C4.97 17.39 5.01 17.44 5.06 17.46L9.68 19.02C9.77 19.05 9.86 18.98 9.86 18.89V16.04C9.86 15.98 9.82 15.93 9.77 15.91ZM14.58 10.44L9.95 12C9.9 12.02 9.86 12.07 9.86 12.13V14.98C9.86 15.08 9.95 15.14 10.04 15.11L14.66 13.55C14.72 13.53 14.76 13.48 14.76 13.42V10.57C14.76 10.47 14.66 10.41 14.58 10.44ZM18.92 5.02L11.18 7.51C11.12 7.53 11.08 7.58 11.08 7.64V10.57C11.08 10.62 11.14 10.66 11.2 10.65L18.94 8.15C18.99 8.14 19.03 8.08 19.03 8.02V5.1C19.03 5.04 18.97 5 18.92 5.02Z";

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
        /** Offered top-up added back to the net (§4); absent/"0" when none. */
        giftedAmount?: string;
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
        /**
         * Whether French VAT applies to this merchant (country === "FR").
         * When false, the reward table shows a 0% rate and the recap's TVA is
         * 0 (TTC === HT) — reverse-charge / autoliquidation, same rule as the
         * deposit/withdraw VAT lines.
         */
        vatApplicable: boolean;
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
    };
};

const PAGE_WIDTH = 595.28; // A4 @ 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const DARK = rgb(0.13, 0.13, 0.13);
const GRAY = rgb(0.45, 0.45, 0.45);
const WHITE = rgb(1, 1, 1);
/** Frak brand blue (#0043EF) — the badge background. */
const BRAND_BLUE = rgb(0x00 / 255, 0x43 / 255, 0xef / 255);
/** Rendered size (points) of the square brand badge in the document header. */
const LOGO_SIZE = 30;

/**
 * The WinAnsi (CP-1252) "extra" glyphs that live in the 0x80–0x9F byte range,
 * which Unicode maps to code points OUTSIDE the Latin-1 (<= 0xFF) block. These
 * are encodable by pdf-lib's StandardFonts even though their code points are
 * > 0xFF, so they must be whitelisted explicitly. Notably includes € (U+20AC)
 * and … (U+2026), which appear on money documents.
 */
const WIN_ANSI_HIGH_CODE_POINTS = new Set<number>([
    0x20ac, // € EURO SIGN
    0x201a, // ‚ SINGLE LOW-9 QUOTATION MARK
    0x0192, // ƒ LATIN SMALL LETTER F WITH HOOK
    0x201e, // „ DOUBLE LOW-9 QUOTATION MARK
    0x2026, // … HORIZONTAL ELLIPSIS
    0x2020, // † DAGGER
    0x2021, // ‡ DOUBLE DAGGER
    0x02c6, // ˆ MODIFIER LETTER CIRCUMFLEX ACCENT
    0x2030, // ‰ PER MILLE SIGN
    0x0160, // Š LATIN CAPITAL LETTER S WITH CARON
    0x2039, // ‹ SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    0x0152, // Œ LATIN CAPITAL LIGATURE OE
    0x017d, // Ž LATIN CAPITAL LETTER Z WITH CARON
    0x2018, // ' LEFT SINGLE QUOTATION MARK
    0x2019, // ' RIGHT SINGLE QUOTATION MARK
    0x201c, // " LEFT DOUBLE QUOTATION MARK
    0x201d, // " RIGHT DOUBLE QUOTATION MARK
    0x2022, // • BULLET
    0x2013, // – EN DASH
    0x2014, // — EM DASH
    0x02dc, // ˜ SMALL TILDE
    0x2122, // ™ TRADE MARK SIGN
    0x0161, // š LATIN SMALL LETTER S WITH CARON
    0x203a, // › SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    0x0153, // œ LATIN SMALL LIGATURE OE
    0x017e, // ž LATIN SMALL LETTER Z WITH CARON
    0x0178, // Ÿ LATIN CAPITAL LETTER Y WITH DIAERESIS
]);

/**
 * The five bytes in the 0x80–0x9F range that CP-1252 leaves UNDEFINED — they
 * have no glyph and pdf-lib's StandardFonts cannot encode them, so despite
 * being <= 0xFF they must be replaced with "?" like any other unmappable char.
 */
const WIN_ANSI_UNDEFINED_LOW_CODE_POINTS = new Set<number>([
    0x81, 0x8d, 0x8f, 0x90, 0x9d,
]);

/**
 * Sanitizes text to the glyph set pdf-lib's StandardFonts (WinAnsi / CP-1252)
 * can encode, replacing anything else with "?" rather than throwing at draw
 * time. Kept characters:
 *   - Latin-1 (<= 0xFF), EXCEPT the five CP-1252-undefined bytes
 *     (0x81, 0x8D, 0x8F, 0x90, 0x9D);
 *   - the CP-1252 "extra" glyphs whose Unicode code points sit above 0xFF
 *     (€, …, curly quotes, dashes, …) — see `WIN_ANSI_HIGH_CODE_POINTS`.
 * Everything else (emoji, CJK, exotic symbols…) becomes "?".
 *
 * Exported for unit testing.
 */
export function sanitizeForWinAnsi(input: string): string {
    let out = "";
    for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0xff) {
            out += WIN_ANSI_UNDEFINED_LOW_CODE_POINTS.has(code) ? "?" : ch;
        } else {
            out += WIN_ANSI_HIGH_CODE_POINTS.has(code) ? ch : "?";
        }
    }
    return out;
}

/**
 * Formats a frozen decimal string for display only (fr-FR thousands + 2dp,
 * fiat symbol). Never used for math. Shows the fiat equivalent of the
 * stablecoin amount — the crypto token symbol/address is never printed.
 */
function formatMoney(value: string, currency: string): string {
    const fiat = fiatFor(currency);
    const n = Number.parseFloat(value);
    const formatted = Number.isFinite(n)
        ? n.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })
        : value;
    // Intl may group fr-FR digits with a narrow no-break space (U+202F) that
    // isn't WinAnsi-encodable; normalize it (and NBSP) to a plain space before
    // the glyph-sanitize step would otherwise turn it into "?".
    const normalized = formatted.replace(/[\u00a0\u202f]/g, " ");
    return `${normalized} ${fiat.symbol}`;
}

function isVatApplicable(vatAmount: string | undefined): boolean {
    if (!vatAmount) return false;
    const n = Number.parseFloat(vatAmount);
    return Number.isFinite(n) && n > 0;
}

function isPositiveAmount(value: string | undefined): value is string {
    if (!value) return false;
    const n = Number.parseFloat(value);
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
     * Draws a word-wrapped paragraph from the current position, advancing `y`
     * past every line drawn (including the last). Used for the longer legal /
     * attestation copy that can't fit on a single line.
     */
    paragraph(
        text: string,
        options: DrawOptions & { maxWidth?: number; lineHeight?: number } = {}
    ): void {
        const {
            x = MARGIN,
            size = 10,
            useFont = this.font,
            color = DARK,
            lineHeight = size + 3,
        } = options;
        const maxWidth = options.maxWidth ?? PAGE_WIDTH - MARGIN - x;
        const words = sanitizeForWinAnsi(text).split(/\s+/).filter(Boolean);
        let line = "";
        const flush = () => {
            if (!line) return;
            this.page.drawText(line, {
                x,
                y: this.y,
                size,
                font: useFont,
                color,
            });
            this.y -= lineHeight;
            line = "";
        };
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && useFont.widthOfTextAtSize(candidate, size) > maxWidth) {
                flush();
                line = word;
            } else {
                line = candidate;
            }
        }
        flush();
    }

    /**
     * Draws an SVG path on the current page. `x`/`y` is where the path's SVG
     * origin lands (SVG y grows downward from there), `scale` maps the path's
     * viewBox units to points. Used to stamp the brand badge in page-fixed
     * coordinates, independent of the text cursor.
     */
    drawSvg(
        path: string,
        opts: { x: number; y: number; scale: number; color: RGB }
    ): void {
        this.page.drawSvgPath(path, {
            x: opts.x,
            y: opts.y,
            scale: opts.scale,
            color: opts.color,
        });
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

        this.drawBrandLogo(cursor);

        if (dto.kind === "monthly_bill" && dto.monthlyBill) {
            this.drawMonthlyBillHeader(cursor, dto, bold);
            this.drawPartyBlocks(cursor, dto, bold);
            this.drawRewardTable(cursor, dto.monthlyBill, bold);
            this.drawTvaAndRecap(cursor, dto.monthlyBill, bold);
            this.drawLedgerStatus(cursor, dto.monthlyBill, bold);
            this.drawFooters(pdfDoc, font);
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
        this.drawAttestation(cursor, dto, bold);

        this.drawFooters(pdfDoc, font);
        return pdfDoc.save();
    }

    /**
     * Stamps the legal footer on every page: Frak's SIREN + intra-community
     * VAT number on the top line, the SAS capital-social mention below it.
     * Drawn at page-fixed coordinates below the content bottom margin, after
     * all content is laid out, so it lands on every page including any the
     * annex/table pagination added.
     */
    private drawFooters(pdfDoc: PDFDocument, font: PDFFont): void {
        const line1 = `${FRAK_SELLER.companyName} — SIREN : ${FRAK_SELLER.siren} — TVA : ${FRAK_SELLER.vatNumber}`;
        const line2 = FRAK_SELLER.legalForm;
        for (const page of pdfDoc.getPages()) {
            page.drawText(sanitizeForWinAnsi(line1), {
                x: MARGIN,
                y: 34,
                size: 8,
                font,
                color: GRAY,
            });
            page.drawText(sanitizeForWinAnsi(line2), {
                x: MARGIN,
                y: 22,
                size: 8,
                font,
                color: GRAY,
            });
        }
    }

    /**
     * Stamps the Frak brand badge in the top-right corner of the first page,
     * at page-fixed coordinates so it never collides with the left-aligned
     * title/header text. Blue rounded square first, white "F" glyph on top.
     */
    private drawBrandLogo(cursor: PageCursor): void {
        const scale = LOGO_SIZE / LOGO_VIEWBOX;
        // Top-left corner of the badge: flush to the right margin, with its
        // top aligned a little above the title's baseline.
        const x = PAGE_WIDTH - MARGIN - LOGO_SIZE;
        const y = PAGE_HEIGHT - MARGIN + LOGO_SIZE - 8;
        cursor.drawSvg(LOGO_BADGE_BG_PATH, { x, y, scale, color: BRAND_BLUE });
        cursor.drawSvg(LOGO_BADGE_F_PATH, { x, y, scale, color: WHITE });
    }

    private drawMonthlyBillHeader(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const monthlyBill = dto.monthlyBill;
        if (!monthlyBill) return;

        cursor.text("Facture mensuelle", { size: 20, useFont: bold });
        cursor.newLine(28);

        cursor.text(`Référence : ${dto.reference}`, { size: 11 });
        cursor.newLine(14);
        const start = monthlyBill.periodStart.toISOString().slice(0, 10);
        const end = monthlyBill.periodEnd.toISOString().slice(0, 10);
        cursor.text(`Période : du ${start} au ${end}`, { size: 11 });
        cursor.newLine(14);
        cursor.text("Type de vente : Prestations de services", { size: 11 });
        cursor.newLine(24);
    }

    /**
     * The distributed rewards, as a fiat invoice table (never crypto
     * amounts/addresses). Rows are grouped by identical reward amount — every
     * reward worth the same is one line whose `Qté` is the count. Columns:
     * `Produits | Qté | Prix u. HT | TVA (%) | Total HT`. `Prix u. HT` is the
     * distributed amount plus the 20% Frak fee (§4); `Total HT = Prix u. HT × Qté`.
     */
    private drawRewardTable(
        cursor: PageCursor,
        monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        bold: PDFFont
    ): void {
        cursor.text("Récompenses distribuées", { size: 13, useFont: bold });
        cursor.newLine(20);

        const col = {
            produit: MARGIN,
            qte: 285,
            prix: 330,
            tva: 430,
            total: 485,
        };
        cursor.text("Produits", { x: col.produit, size: 8, color: GRAY });
        cursor.text("Qté", { x: col.qte, size: 8, color: GRAY });
        cursor.text("Prix u. HT", { x: col.prix, size: 8, color: GRAY });
        cursor.text("TVA (%)", { x: col.tva, size: 8, color: GRAY });
        cursor.text("Total HT", { x: col.total, size: 8, color: GRAY });
        cursor.newLine(15);

        const groups = this.groupRewards(monthlyBill.annexRows);
        if (groups.length === 0) {
            cursor.text("Aucune récompense distribuée sur cette période.", {
                size: 9,
                color: GRAY,
            });
            cursor.newLine(18);
            return;
        }

        // 20% French VAT, or 0% for a non-FR merchant (reverse-charge).
        const tvaPct = monthlyBill.vatApplicable ? "20" : "0";
        for (const group of groups) {
            cursor.ensureSpace(15);
            cursor.text(group.label, { x: col.produit, size: 9 });
            cursor.text(String(group.qty), { x: col.qte, size: 9 });
            cursor.text(formatMoney(group.unitHt.toFixed(2), group.currency), {
                x: col.prix,
                size: 9,
            });
            cursor.text(tvaPct, { x: col.tva, size: 9 });
            cursor.text(formatMoney(group.totalHt.toFixed(2), group.currency), {
                x: col.total,
                size: 9,
            });
            cursor.newLine(15);
        }
        cursor.newLine(8);
    }

    /**
     * Folds the per-line settled rewards into invoice rows grouped by identical
     * reward amount (same currency + same amount → one line, `qty` accumulated).
     * `unitHt = amount × (1 + Frak fee)`, `totalHt = unitHt × qty`. Sorted by
     * `totalHt` descending so the biggest lines lead. Pure display math on the
     * frozen amounts — decimal.js, never native float.
     */
    private groupRewards(
        rows: NonNullable<BillingPdfDocumentDto["monthlyBill"]>["annexRows"]
    ): Array<{
        currency: string;
        qty: number;
        unitHt: Decimal;
        totalHt: Decimal;
        label: string;
    }> {
        const map = new Map<
            string,
            { currency: string; base: Decimal; qty: number }
        >();
        for (const row of rows) {
            const base = new Decimal(row.amount);
            const key = `${row.currency}:${base.toFixed(18)}`;
            const existing = map.get(key);
            if (existing) {
                existing.qty += 1;
            } else {
                map.set(key, { currency: row.currency, base, qty: 1 });
            }
        }
        return [...map.values()]
            .map(({ currency, base, qty }) => {
                const unitHt = base.mul(new Decimal(1).plus(FRAK_FEE_RATE));
                return {
                    currency,
                    qty,
                    unitHt,
                    totalHt: unitHt.mul(qty),
                    label: `Récompense ${formatMoney(base.toFixed(2), currency)}`,
                };
            })
            .sort((a, b) => b.totalHt.comparedTo(a.totalHt));
    }

    /**
     * Two side-by-side blocks under the reward table: `Détails TVA` (the applied
     * rate + its amount) on the left, `Récapitulatif` (Total HT / Total TVA /
     * Total TTC) on the right. Totals are the sum of the table's `Total HT`
     * lines; TVA is the applied rate of that, TTC is HT + TVA. A non-FR merchant
     * has a 0% rate (reverse-charge), so Total TVA is 0 and TTC === HT.
     */
    private drawTvaAndRecap(
        cursor: PageCursor,
        monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        bold: PDFFont
    ): void {
        const groups = this.groupRewards(monthlyBill.annexRows);
        // Bills are single-currency in practice (one merchant bank/token); the
        // recap is shown in the reward rows' currency, falling back to the
        // ledger's currency when there are no rewards.
        const currency =
            monthlyBill.annexRows[0]?.currency ??
            monthlyBill.ledgers[0]?.currency ??
            "eure";

        const vatRate = monthlyBill.vatApplicable ? VAT_RATE : new Decimal(0);
        let totalHt = new Decimal(0);
        for (const group of groups) totalHt = totalHt.plus(group.totalHt);
        const totalTva = totalHt.mul(vatRate);
        const totalTtc = totalHt.plus(totalTva);

        cursor.ensureSpace(70);
        const topY = cursor.y;
        const rightX = PAGE_WIDTH / 2 + 10;

        cursor.text("Détails TVA", { size: 12, useFont: bold });
        cursor.newLine(16);
        cursor.text(
            monthlyBill.vatApplicable
                ? "Taux : 20 %"
                : "Taux : 0 % (autoliquidation)",
            { size: 9 }
        );
        cursor.newLine(13);
        cursor.text(`Montant : ${formatMoney(totalTva.toFixed(2), currency)}`, {
            size: 9,
        });
        const leftEndY = cursor.y;

        cursor.y = topY;
        cursor.text("Récapitulatif", { x: rightX, size: 12, useFont: bold });
        cursor.newLine(16);
        cursor.text(`Total HT : ${formatMoney(totalHt.toFixed(2), currency)}`, {
            x: rightX,
            size: 9,
        });
        cursor.newLine(13);
        cursor.text(
            `Total TVA : ${formatMoney(totalTva.toFixed(2), currency)}`,
            {
                x: rightX,
                size: 9,
            }
        );
        cursor.newLine(13);
        cursor.text(
            `Total TTC : ${formatMoney(totalTtc.toFixed(2), currency)}`,
            {
                x: rightX,
                size: 9,
                useFont: bold,
            }
        );
        const rightEndY = cursor.y;

        cursor.y = Math.min(leftEndY, rightEndY) - 26;
    }

    /**
     * The campaign-bank ledger status, below the recap: the amount initially
     * credited (opening balance) and the balance remaining after this bill
     * (closing balance), one pair per currency ledger, shown in that ledger's
     * fiat currency (never hardcoded EUR).
     */
    private drawLedgerStatus(
        cursor: PageCursor,
        monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
        bold: PDFFont
    ): void {
        cursor.ensureSpace(60);
        cursor.text("État du compte", { size: 13, useFont: bold });
        cursor.newLine(20);

        for (const ledger of monthlyBill.ledgers) {
            cursor.ensureSpace(36);
            cursor.text(
                `Montant initial crédité : ${formatMoney(ledger.openingBalance, ledger.currency)}`,
                { size: 10 }
            );
            cursor.newLine(15);
            cursor.text(
                `Solde restant sur le compte après cette facture : ${formatMoney(ledger.closingBalance, ledger.currency)}`,
                { size: 10 }
            );
            cursor.newLine(18);
        }
    }

    private drawHeader(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        // Neither is an invoice (see the attestation) — titled "Note", not
        // "Facture"; only the monthly bill is an actual invoice.
        const title =
            dto.kind === "deposit" ? "Note de dépôt" : "Note de restitution";
        cursor.text(title, { size: 20, useFont: bold });
        cursor.newLine(28);

        cursor.text(`Référence : ${dto.reference}`, { size: 11 });
        cursor.newLine(14);
        cursor.text(`Date : ${dto.documentDate.toISOString().slice(0, 10)}`, {
            size: 11,
        });
        cursor.newLine(14);
        cursor.text(`Devise : ${fiatFor(dto.currency).code}`, { size: 11 });
        cursor.newLine(18);

        const objet = dto.kind === "deposit" ? DEPOSIT_OBJET : WITHDRAW_OBJET;
        cursor.paragraph(`Objet : ${objet}`, { size: 10, lineHeight: 14 });
        cursor.newLine(16);
    }

    private drawPartyBlocks(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const seller = FRAK_SELLER;
        const blockTopY = cursor.y;
        const rightX = PAGE_WIDTH / 2 + 10;

        // SIREN + VAT live in the page footer now (legal mentions), not here.
        cursor.text("Émis par", { size: 9, color: GRAY });
        cursor.newLine(14);
        cursor.text(seller.companyName, { useFont: bold });
        cursor.newLine(13);
        for (const line of seller.addressLines) {
            cursor.text(line, { size: 9 });
            cursor.newLine(12);
        }
        cursor.text(seller.email, { size: 9 });
        cursor.newLine(12);
        // Bottom of the left (seller) column.
        const leftEndY = cursor.y;

        // Reset y to draw the buyer block in the right column.
        cursor.y = blockTopY;
        // Deposit/withdraw are attestations (not invoices) — "Adressé à";
        // only the monthly bill is an actual invoice ("Facturé à").
        const buyerLabel =
            dto.kind === "monthly_bill" ? "Facturé à" : "Adressé à";
        cursor.text(buyerLabel, { x: rightX, size: 9, color: GRAY });
        cursor.newLine(14);
        cursor.text(
            dto.buyer.companyName ?? "(aucune raison sociale renseignée)",
            {
                x: rightX,
                useFont: bold,
            }
        );
        cursor.newLine(13);
        if (dto.buyer.vatNumber) {
            cursor.text(`TVA : ${dto.buyer.vatNumber}`, {
                x: rightX,
                size: 9,
            });
            cursor.newLine(13);
        }
        for (const line of dto.buyer.addressLines) {
            cursor.text(line, { x: rightX, size: 9 });
            cursor.newLine(12);
        }
        // Bottom of the right (buyer) column.
        const rightEndY = cursor.y;

        // Continue below whichever column is taller (lower on the page), so a
        // taller seller block can't be overwritten by the next section.
        cursor.y = Math.min(leftEndY, rightEndY) - 20;
    }

    private drawAmounts(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        cursor.text("Montants", { size: 13, useFont: bold });
        cursor.newLine(20);

        cursor.text(
            `Montant brut : ${formatMoney(dto.grossAmount, dto.currency)}`
        );
        cursor.newLine(15);
        cursor.text(
            `Montant net : ${formatMoney(dto.netAmount, dto.currency)}`
        );
        cursor.newLine(20);
    }

    /**
     * The closing attestation for a deposit/withdraw note: a couple of
     * word-wrapped sentences stating what the document certifies and that it is
     * NOT an invoice (last line emphasized). No-op for the monthly bill, which
     * is the actual invoice.
     */
    private drawAttestation(
        cursor: PageCursor,
        dto: BillingPdfDocumentDto,
        bold: PDFFont
    ): void {
        const lines =
            dto.kind === "deposit"
                ? DEPOSIT_ATTESTATION
                : dto.kind === "withdraw"
                  ? WITHDRAW_ATTESTATION
                  : null;
        if (!lines) return;

        cursor.ensureSpace(70);
        cursor.newLine(8);
        lines.forEach((line, index) => {
            const emphasize = index === lines.length - 1;
            cursor.paragraph(line, {
                size: 9,
                lineHeight: 13,
                ...(emphasize ? { useFont: bold } : {}),
            });
            cursor.newLine(5);
        });
    }

    private drawDepositDetails(
        cursor: PageCursor,
        deposit: NonNullable<BillingPdfDocumentDto["deposit"]>,
        currency: string
    ): void {
        if (isVatApplicable(deposit.vatAmount)) {
            cursor.text(
                `TVA (20 %) : ${formatMoney(deposit.vatAmount, currency)}`
            );
        } else {
            cursor.text("TVA : autoliquidation / non applicable", {
                color: GRAY,
            });
        }
        cursor.newLine(15);
        cursor.text(
            `Frais Frak : ${formatMoney(deposit.frakFeeAmount, currency)}`
        );
        cursor.newLine(15);
        if (isPositiveAmount(deposit.giftedAmount)) {
            cursor.text(
                `Montant offert : ${formatMoney(deposit.giftedAmount, currency)}`
            );
            cursor.newLine(15);
        }
        if (deposit.paymentPlatform) {
            cursor.text(`Plateforme de paiement : ${deposit.paymentPlatform}`, {
                size: 9,
                color: GRAY,
            });
            cursor.newLine(14);
        }
        if (deposit.note) {
            cursor.newLine(6);
            cursor.text(`Note : ${deposit.note}`, { size: 9 });
            cursor.newLine(14);
        }
    }

    private drawWithdrawDetails(
        cursor: PageCursor,
        withdraw: NonNullable<BillingPdfDocumentDto["withdraw"]>,
        currency: string,
        bold: PDFFont
    ): void {
        cursor.text("Détail de la restitution", { size: 12, useFont: bold });
        cursor.newLine(18);
        cursor.text(
            `Montant restant sur le compte : ${formatMoney(withdraw.remainingBankAmount, currency)}`
        );
        cursor.newLine(15);

        const ratioPct = (
            Number.parseFloat(withdraw.distributedRatio) * 100
        ).toFixed(2);
        cursor.text(`Ratio distribué : ${ratioPct} %`);
        cursor.newLine(15);

        if (isVatApplicable(withdraw.restitutedVat)) {
            cursor.text(
                `TVA restituée : ${formatMoney(withdraw.restitutedVat, currency)}`
            );
        } else {
            cursor.text("TVA restituée : autoliquidation / non applicable", {
                color: GRAY,
            });
        }
        cursor.newLine(15);
        cursor.text(
            `Frais Frak restitués : ${formatMoney(withdraw.restitutedFrakFee, currency)}`
        );
        cursor.newLine(15);
        cursor.text(
            `Total envoyé sur le compte de destination : ${formatMoney(withdraw.bankSent, currency)}`,
            { useFont: bold }
        );
        cursor.newLine(18);
        cursor.text(`Compte de destination : ${withdraw.maskedIban}`, {
            size: 10,
        });
        cursor.newLine(16);
        if (withdraw.note) {
            cursor.newLine(6);
            cursor.text(`Note : ${withdraw.note}`, { size: 9 });
            cursor.newLine(14);
        }
    }
}
