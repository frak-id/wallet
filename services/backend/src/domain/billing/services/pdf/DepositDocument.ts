import {
    formatMoney,
    GRAY,
    isPositiveAmount,
    isVatApplicable,
    type PageCursor,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

export function drawDepositDetails(
    cursor: PageCursor,
    deposit: NonNullable<BillingPdfDocumentDto["deposit"]>,
    currency: string
): void {
    if (isVatApplicable(deposit.vatAmount)) {
        cursor.text(`TVA (20 %) : ${formatMoney(deposit.vatAmount, currency)}`);
    } else {
        cursor.text("TVA : autoliquidation / non applicable", {
            color: GRAY,
        });
    }
    cursor.newLine(15);
    cursor.text(`Frais Frak : ${formatMoney(deposit.frakFeeAmount, currency)}`);
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
