import {
    drawVatLine,
    formatMoney,
    GRAY,
    isPositiveAmount,
    type PageCursor,
} from "./primitives";
import type { BillingPdfDocumentDto } from "./types";

export function drawDepositDetails(
    cursor: PageCursor,
    deposit: NonNullable<BillingPdfDocumentDto["deposit"]>,
    currency: string
): void {
    drawVatLine(cursor, "TVA (20 %)", deposit.vatAmount, currency, "TVA");
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
