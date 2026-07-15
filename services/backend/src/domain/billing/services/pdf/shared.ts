import type { PDFDocument, PDFFont } from "pdf-lib";
import {
    DEPOSIT_ATTESTATION,
    DEPOSIT_OBJET,
    FRAK_SELLER,
    WITHDRAW_ATTESTATION,
    WITHDRAW_OBJET,
} from "./copy";
import {
    BRAND_BLUE,
    fiatFor,
    formatMoney,
    GRAY,
    MARGIN,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    type PageCursor,
    sanitizeForWinAnsi,
    WHITE,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

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

/** Rendered size (points) of the square brand badge in the document header. */
const LOGO_SIZE = 30;

/**
 * Stamps the legal footer on every page: Frak's SIREN + intra-community
 * VAT number on the top line, the SAS capital-social mention below it.
 * Drawn at page-fixed coordinates below the content bottom margin, after
 * all content is laid out, so it lands on every page including any the
 * annex/table pagination added.
 */
export function drawFooters(pdfDoc: PDFDocument, font: PDFFont): void {
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
export function drawBrandLogo(cursor: PageCursor): void {
    const scale = LOGO_SIZE / LOGO_VIEWBOX;
    // Top-left corner of the badge: flush to the right margin, with its
    // top aligned a little above the title's baseline.
    const x = PAGE_WIDTH - MARGIN - LOGO_SIZE;
    const y = PAGE_HEIGHT - MARGIN + LOGO_SIZE - 8;
    cursor.drawSvg(LOGO_BADGE_BG_PATH, { x, y, scale, color: BRAND_BLUE });
    cursor.drawSvg(LOGO_BADGE_F_PATH, { x, y, scale, color: WHITE });
}

export function drawHeader(
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

export function drawPartyBlocks(
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
    const buyerLabel = dto.kind === "monthly_bill" ? "Facturé à" : "Adressé à";
    cursor.text(buyerLabel, { x: rightX, size: 9, color: GRAY });
    cursor.newLine(14);
    cursor.text(dto.buyer.companyName ?? "(aucune raison sociale renseignée)", {
        x: rightX,
        useFont: bold,
    });
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

export function drawAmounts(
    cursor: PageCursor,
    dto: BillingPdfDocumentDto,
    bold: PDFFont
): void {
    cursor.text("Montants", { size: 13, useFont: bold });
    cursor.newLine(20);

    cursor.text(`Montant brut : ${formatMoney(dto.grossAmount, dto.currency)}`);
    cursor.newLine(15);
    cursor.text(`Montant net : ${formatMoney(dto.netAmount, dto.currency)}`);
    cursor.newLine(20);
}

/**
 * The closing attestation for a deposit/withdraw note: a couple of
 * word-wrapped sentences stating what the document certifies and that it is
 * NOT an invoice (last line emphasized). No-op for the monthly bill, which
 * is the actual invoice.
 */
export function drawAttestation(
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
