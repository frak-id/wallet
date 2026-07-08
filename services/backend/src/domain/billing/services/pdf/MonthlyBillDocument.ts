import Decimal from "decimal.js";
import type { PDFFont } from "pdf-lib";
import {
    FRAK_FEE_RATE,
    formatMoney,
    GRAY,
    MARGIN,
    PAGE_WIDTH,
    type PageCursor,
    VAT_RATE,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

export function drawMonthlyBillHeader(
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
export function drawRewardTable(
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

    const groups = groupRewards(monthlyBill.annexRows);
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
export function groupRewards(
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
export function drawTvaAndRecap(
    cursor: PageCursor,
    monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
    bold: PDFFont
): void {
    const groups = groupRewards(monthlyBill.annexRows);
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
    cursor.text(`Total TVA : ${formatMoney(totalTva.toFixed(2), currency)}`, {
        x: rightX,
        size: 9,
    });
    cursor.newLine(13);
    cursor.text(`Total TTC : ${formatMoney(totalTtc.toFixed(2), currency)}`, {
        x: rightX,
        size: 9,
        useFont: bold,
    });
    const rightEndY = cursor.y;

    cursor.y = Math.min(leftEndY, rightEndY) - 26;
}

/**
 * The campaign-bank ledger status, below the recap: the amount initially
 * credited (opening balance) and the balance remaining after this bill
 * (closing balance), one pair per currency ledger, shown in that ledger's
 * fiat currency (never hardcoded EUR).
 */
export function drawLedgerStatus(
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
