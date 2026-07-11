import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawDepositDetails } from "./DepositDocument";
import {
    drawLedgerStatus,
    drawMonthlyBillHeader,
    drawOtherRewards,
    drawRewardTable,
    drawTvaAndRecap,
    groupRewards,
} from "./MonthlyBillDocument";
import { PAGE_HEIGHT, PAGE_WIDTH, PageCursor } from "./primitives";
import {
    drawAmounts,
    drawAttestation,
    drawBrandLogo,
    drawFooters,
    drawHeader,
    drawPartyBlocks,
} from "./shared";
import type { BillingPdfDocumentDto } from "./types";
import { drawWithdrawDetails } from "./WithdrawDocument";

export { sanitizeForWinAnsi } from "./primitives";
export type { BillingPdfDocumentDto } from "./types";

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

        drawBrandLogo(cursor);

        if (dto.kind === "monthly_bill" && dto.monthlyBill) {
            // Grouped once here, shared by the reward table and the recap.
            const rewardGroups = groupRewards(dto.monthlyBill.annexRows);
            drawMonthlyBillHeader(cursor, dto, bold);
            drawPartyBlocks(cursor, dto, bold);
            drawRewardTable(cursor, dto.monthlyBill, bold, rewardGroups);
            // The recap sums only the document's primary currency — the same
            // currency the frozen grossAmount/netAmount are computed in.
            drawTvaAndRecap(
                cursor,
                dto.monthlyBill,
                bold,
                rewardGroups,
                dto.currency
            );
            drawOtherRewards(cursor, dto.monthlyBill, bold);
            drawLedgerStatus(cursor, dto.monthlyBill, bold);
            drawFooters(pdfDoc, font);
            return pdfDoc.save();
        }

        drawHeader(cursor, dto, bold);
        drawPartyBlocks(cursor, dto, bold);
        drawAmounts(cursor, dto, bold);

        if (dto.kind === "deposit" && dto.deposit) {
            drawDepositDetails(cursor, dto.deposit, dto.currency);
        }
        if (dto.kind === "withdraw" && dto.withdraw) {
            drawWithdrawDetails(cursor, dto.withdraw, dto.currency, bold);
        }
        drawAttestation(cursor, dto, bold);

        drawFooters(pdfDoc, font);
        return pdfDoc.save();
    }
}
