import type { PDFFont } from "pdf-lib";
import { type BreakdownRow, drawBreakdownCard } from "./BreakdownCard";
import {
    DEPOSIT_HEADLINE_LABEL,
    DEPOSIT_TOTAL_CAPTION,
    DEPOSIT_TOTAL_LABEL,
} from "./copy";
import {
    FRAK_FEE_RATE,
    formatMoney,
    formatSigned,
    GRAY,
    isPositiveAmount,
    isVatApplicable,
    type PageCursor,
    ratePercent,
    VAT_RATE,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

/**
 * Amount deposited first, then TVA and Frak fees, ending on the amount that
 * remains available to distribute rewards to end users.
 */
export function drawDepositDetails(
    cursor: PageCursor,
    dto: BillingPdfDocumentDto,
    deposit: NonNullable<BillingPdfDocumentDto["deposit"]>,
    bold: PDFFont
): void {
    const { currency } = dto;
    const vatApplies = isVatApplicable(deposit.vatAmount);

    const rows: BreakdownRow[] = [
        {
            label: vatApplies
                ? `TVA (${ratePercent(VAT_RATE)})`
                : "TVA (autoliquidation / non applicable)",
            value: vatApplies
                ? formatSigned("-", deposit.vatAmount, currency)
                : formatMoney("0", currency),
        },
        {
            label: `Frais Frak (${ratePercent(FRAK_FEE_RATE)})`,
            value: formatSigned("-", deposit.frakFeeAmount, currency),
        },
    ];
    if (isPositiveAmount(deposit.giftedAmount)) {
        rows.push({
            label: "Montant offert",
            value: formatSigned("+", deposit.giftedAmount, currency),
        });
    }

    cursor.text("Détail du dépôt", { size: 13, useFont: bold });
    cursor.newLine(22);
    drawBreakdownCard(cursor, bold, {
        headlineLabel: DEPOSIT_HEADLINE_LABEL,
        headlineValue: formatMoney(dto.grossAmount, currency),
        headlineCaption: vatApplies
            ? "TVA et frais Frak inclus"
            : "Frais Frak inclus",
        rows,
        totalLabel: DEPOSIT_TOTAL_LABEL,
        totalValue: formatMoney(dto.netAmount, currency),
        totalCaption: DEPOSIT_TOTAL_CAPTION,
    });

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
