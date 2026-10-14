import type { PDFFont } from "pdf-lib";
import { type BreakdownRow, drawBreakdownCard } from "./BreakdownCard";
import {
    formatMoney,
    formatSigned,
    isVatApplicable,
    type PageCursor,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

export function drawWithdrawDetails(
    cursor: PageCursor,
    withdraw: NonNullable<BillingPdfDocumentDto["withdraw"]>,
    currency: string,
    bold: PDFFont
): void {
    const ratioPct = (
        Number.parseFloat(withdraw.distributedRatio) * 100
    ).toFixed(2);

    const rows: BreakdownRow[] = [
        {
            label: isVatApplicable(withdraw.restitutedVat)
                ? "TVA restituée"
                : "TVA restituée (autoliquidation / non applicable)",
            value: formatSigned("+", withdraw.restitutedVat, currency),
        },
        {
            label: "Frais Frak restitués",
            value: formatSigned("+", withdraw.restitutedFrakFee, currency),
        },
        {
            label: `Ratio du dépôt distribué en récompenses : ${ratioPct} %`,
            value: "",
            sub: true,
        },
    ];

    cursor.text("Détail de la restitution", { size: 13, useFont: bold });
    cursor.newLine(22);
    drawBreakdownCard(cursor, bold, {
        headlineLabel: "Montant restant sur le compte",
        headlineValue: formatMoney(withdraw.remainingBankAmount, currency),
        headlineCaption: "Disponible pour les récompenses, non distribué",
        rows,
        totalLabel: "Total envoyé sur le compte de destination",
        totalValue: formatMoney(withdraw.bankSent, currency),
        totalCaption: `Compte de destination : ${withdraw.maskedIban}`,
    });

    if (withdraw.note) {
        cursor.newLine(6);
        cursor.text(`Note : ${withdraw.note}`, { size: 9 });
        cursor.newLine(14);
    }
}
