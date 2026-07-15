import type { PDFFont } from "pdf-lib";
import {
    formatMoney,
    GRAY,
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
