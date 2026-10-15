import Decimal from "decimal.js";
import type { PDFFont } from "pdf-lib";
import { drawBreakdownCard } from "./BreakdownCard";
import { grossUpAvailable } from "./breakdown";
import {
    FRAK_FEE_RATE,
    fiatFor,
    formatMoney,
    formatSigned,
    GRAY,
    MARGIN,
    PAGE_WIDTH,
    type PageCursor,
    ratePercent,
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

/** One folded invoice line of the reward table — see `groupRewards`. */
export type RewardGroup = {
    currency: string;
    qty: number;
    unitHt: Decimal;
    totalHt: Decimal;
    label: string;
};

/**
 * The distributed rewards, as a fiat invoice table (never crypto
 * amounts/addresses). Rows are grouped by identical reward amount — every
 * reward worth the same is one line whose `Qté` is the count. Columns:
 * `Produits | Qté | Prix u. HT | TVA (%) | Total HT`. `Prix u. HT` is the
 * distributed amount plus the 20% Frak fee (§4); `Total HT = Prix u. HT × Qté`.
 * `groups` is computed ONCE by the render entry point (from `groupRewards`)
 * and shared with `drawTvaAndRecap` — never recomputed per draw call.
 */
export function drawRewardTable(
    cursor: PageCursor,
    monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
    bold: PDFFont,
    groups: RewardGroup[]
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
    cursor.newLine(18);
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
): RewardGroup[] {
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

/** One currency's billed totals in the recap — see `recapTotalsByCurrency`. */
type RecapCurrencyTotals = {
    currency: string;
    totalHt: Decimal;
    totalTva: Decimal;
    totalTtc: Decimal;
};

/**
 * Folds the reward `groups` into per-currency billed totals (Total HT / TVA /
 * TTC), sorted by Total HT descending so the biggest currency leads. Every
 * reward currency is billed in ITS OWN currency — no cross-currency sum (which
 * would be meaningless on a legal document) and, crucially, nothing dropped:
 * a merchant who rewarded in several stablecoins is billed for all of them.
 * A non-FR merchant has a 0% rate (reverse-charge), so TVA is 0 and TTC == HT.
 * When there were no rewards, a single zero row in `fallbackCurrency` keeps the
 * recap non-empty (matching the document's labeled currency).
 */
export function recapTotalsByCurrency(
    groups: RewardGroup[],
    vatApplicable: boolean,
    fallbackCurrency: string
): RecapCurrencyTotals[] {
    const vatRate = vatApplicable ? VAT_RATE : new Decimal(0);
    const htByCurrency = new Map<string, Decimal>();
    for (const group of groups) {
        htByCurrency.set(
            group.currency,
            (htByCurrency.get(group.currency) ?? new Decimal(0)).plus(
                group.totalHt
            )
        );
    }
    if (htByCurrency.size === 0) {
        htByCurrency.set(fallbackCurrency, new Decimal(0));
    }
    return [...htByCurrency.entries()]
        .map(([currency, totalHt]) => {
            const totalTva = totalHt.mul(vatRate);
            return {
                currency,
                totalHt,
                totalTva,
                totalTtc: totalHt.plus(totalTva),
            };
        })
        .sort((a, b) => b.totalHt.comparedTo(a.totalHt));
}

/**
 * Two side-by-side blocks under the reward table: `Détails TVA` (the applied
 * rate + its per-currency amount) on the left, `Récapitulatif` (Total HT /
 * Total TVA / Total TTC) on the right. Both list EVERY reward currency, each
 * billed in its own currency (see `recapTotalsByCurrency`) — the whole point
 * being that a bill shows all the rewards distributed, not only those in the
 * deposit currency. `fallbackCurrency` (the document currency) is used only
 * when the period had no rewards, to keep a labeled zero row. `groups` is
 * computed once by the render entry point.
 */
export function drawTvaAndRecap(
    cursor: PageCursor,
    monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
    bold: PDFFont,
    groups: RewardGroup[],
    fallbackCurrency: string
): void {
    const perCurrency = recapTotalsByCurrency(
        groups,
        monthlyBill.vatApplicable,
        fallbackCurrency
    );

    // ~28pt per currency block on the right + headers; grow with the count so
    // a multi-currency recap doesn't collide with the next section.
    cursor.ensureSpace(50 + perCurrency.length * 20);
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
    for (const { currency, totalTva } of perCurrency) {
        cursor.text(`Montant : ${formatMoney(totalTva.toFixed(2), currency)}`, {
            size: 9,
        });
        cursor.newLine(13);
    }
    const leftEndY = cursor.y;

    cursor.y = topY;
    cursor.text("Récapitulatif", { x: rightX, size: 12, useFont: bold });
    cursor.newLine(16);
    for (const { totalHt, totalTva, totalTtc, currency } of perCurrency) {
        cursor.text(`Total HT : ${formatMoney(totalHt.toFixed(2), currency)}`, {
            x: rightX,
            size: 9,
        });
        cursor.newLine(13);
        cursor.text(
            `Total TVA : ${formatMoney(totalTva.toFixed(2), currency)}`,
            { x: rightX, size: 9 }
        );
        cursor.newLine(13);
        cursor.text(
            `Total TTC : ${formatMoney(totalTtc.toFixed(2), currency)}`,
            { x: rightX, size: 9, useFont: bold }
        );
        cursor.newLine(perCurrency.length > 1 ? 18 : 13);
    }
    const rightEndY = cursor.y;

    cursor.y = Math.min(leftEndY, rightEndY) - 26;
}

/**
 * The campaign-bank account status to date, below the recap: per currency
 * ledger, the amount initially credited, the TVA and Frak fees (one total, then
 * each), the rewards already distributed, and what remains available. Amounts
 * are in the ledger's own fiat currency.
 */
export function drawLedgerStatus(
    cursor: PageCursor,
    monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
    bold: PDFFont
): void {
    cursor.ensureSpace(60);
    cursor.text("État du compte", { size: 13, useFont: bold });
    cursor.newLine(22);

    const { vatApplicable, ledgers } = monthlyBill;
    for (const ledger of ledgers) {
        const { currency } = ledger;
        const distributed = new Decimal(ledger.rewardedToDate).toDecimalPlaces(
            2
        );
        const credited = new Decimal(ledger.closingBalance).plus(
            ledger.rewardedToDate
        );
        const parts = grossUpAvailable(credited.toFixed(), vatApplicable);
        const feesAndVat = new Decimal(parts.vat).plus(parts.frakFee);
        const remaining = new Decimal(parts.available).minus(distributed);

        if (ledgers.length > 1) {
            cursor.ensureSpace(260);
            cursor.text(`Compte en ${fiatFor(currency).code}`, {
                size: 9,
                color: GRAY,
            });
            cursor.newLine(14);
        }
        drawBreakdownCard(cursor, bold, {
            headlineLabel: "Montant initial crédité",
            headlineValue: formatMoney(parts.gross, currency),
            headlineCaption: vatApplicable
                ? "TVA et frais Frak inclus"
                : "Frais Frak inclus",
            rows: [
                {
                    label: vatApplicable
                        ? "Total TVA + frais Frak"
                        : "Total frais Frak (TVA non applicable)",
                    value: formatSigned("-", feesAndVat.toFixed(2), currency),
                    strong: true,
                },
                ...(vatApplicable
                    ? [
                          {
                              label: `dont TVA (${ratePercent(VAT_RATE)})`,
                              value: formatSigned("-", parts.vat, currency),
                              sub: true,
                          },
                      ]
                    : []),
                {
                    label: `dont Frais Frak (${ratePercent(FRAK_FEE_RATE)})`,
                    value: formatSigned("-", parts.frakFee, currency),
                    sub: true,
                },
                {
                    label: "Récompenses déjà distribuées",
                    value: formatSigned("-", distributed.toFixed(2), currency),
                    strong: true,
                },
            ],
            totalLabel: "Disponible pour les récompenses",
            totalValue: formatMoney(remaining.toFixed(2), currency),
            totalCaption:
                "Solde à date, une fois la TVA, les frais Frak et les récompenses déjà distribuées déduits.",
        });
    }
}

/**
 * Informational listing of settled rewards paid in NON-stablecoin tokens —
 * they carry no invoice currency, so they are excluded from the reward
 * table, the recap, and every billed total (§B9). Token amounts only, no
 * fiat conversion. Skipped entirely when there are none.
 */
export function drawOtherRewards(
    cursor: PageCursor,
    monthlyBill: NonNullable<BillingPdfDocumentDto["monthlyBill"]>,
    bold: PDFFont
): void {
    const rows = monthlyBill.otherRewards ?? [];
    if (rows.length === 0) return;

    cursor.ensureSpace(50);
    cursor.text("Autres récompenses (hors facturation)", {
        size: 13,
        useFont: bold,
    });
    cursor.newLine(16);
    cursor.text(
        "Récompenses réglées en jetons hors stablecoins — non facturées, données à titre informatif (montants en jetons).",
        { size: 8, color: GRAY }
    );
    cursor.newLine(15);

    const col = { date: MARGIN, amount: 200 };
    cursor.text("Date", { x: col.date, size: 8, color: GRAY });
    cursor.text("Montant (jetons)", { x: col.amount, size: 8, color: GRAY });
    cursor.newLine(13);

    for (const row of rows) {
        cursor.ensureSpace(13);
        cursor.text(row.settledAt.toISOString().slice(0, 10), {
            x: col.date,
            size: 9,
        });
        cursor.text(new Decimal(row.amount).toFixed(2), {
            x: col.amount,
            size: 9,
        });
        cursor.newLine(13);
    }
    cursor.newLine(8);
}
