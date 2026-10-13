import type { PDFFont } from "pdf-lib";
import {
    BORDER,
    BRAND_BLUE,
    BRAND_TINT,
    GRAY,
    MARGIN,
    PAGE_WIDTH,
    type PageCursor,
} from "./primitives";

export type BreakdownRow = {
    label: string;
    value: string;
    /** Smaller, indented "dont …" sub-line. */
    sub?: boolean;
    /** Bold label + value. */
    strong?: boolean;
};

export type BreakdownCardSpec = {
    headlineLabel: string;
    headlineValue: string;
    headlineCaption?: string;
    rows: BreakdownRow[];
    totalLabel: string;
    totalValue: string;
    totalCaption?: string;
};

const PAD = 16;
const ROW_HEIGHT = 18;
const SUB_ROW_HEIGHT = 15;
const CAPTION_LINE = 12;
const HEADLINE_BLOCK = 58;
const TOTAL_BAND = 34;

/**
 * Amount-first breakdown card shared by the deposit note, the withdraw note
 * and the monthly bill's account status: the headline amount on top, the
 * deductions underneath, and the final highlighted amount last — the same
 * order as the budget card of the Shopify / business dashboards.
 */
export function drawBreakdownCard(
    cursor: PageCursor,
    bold: PDFFont,
    spec: BreakdownCardSpec
): void {
    const left = MARGIN;
    const right = PAGE_WIDTH - MARGIN;
    const innerLeft = left + PAD;
    const innerRight = right - PAD;
    const innerWidth = innerRight - innerLeft;

    const totalCaptionLines = spec.totalCaption
        ? cursor.wrap(spec.totalCaption, { size: 8.5, maxWidth: innerWidth })
        : [];
    const rowsHeight = spec.rows.reduce(
        (sum, row) => sum + (row.sub ? SUB_ROW_HEIGHT : ROW_HEIGHT),
        0
    );
    const height =
        PAD +
        HEADLINE_BLOCK +
        (spec.headlineCaption ? 0 : -12) +
        rowsHeight +
        22 +
        TOTAL_BAND +
        (totalCaptionLines.length > 0
            ? 8 + totalCaptionLines.length * CAPTION_LINE
            : 0) +
        PAD;

    cursor.ensureSpace(height + 8);
    const top = cursor.y + 12;
    const bottom = top - height;
    cursor.rect({
        x: left,
        y: bottom,
        width: right - left,
        height,
        border: BORDER,
    });

    cursor.y = top - PAD - 8;
    cursor.text(spec.headlineLabel, { x: innerLeft, size: 9, color: GRAY });
    cursor.newLine(26);
    cursor.text(spec.headlineValue, {
        x: innerLeft,
        size: 22,
        useFont: bold,
    });
    if (spec.headlineCaption) {
        cursor.newLine(16);
        cursor.text(spec.headlineCaption, {
            x: innerLeft,
            size: 8.5,
            color: GRAY,
        });
    }
    cursor.newLine(14);
    cursor.rule(cursor.y, innerLeft, innerRight);
    cursor.newLine(20);

    for (const row of spec.rows) {
        const size = row.sub ? 9 : 10;
        const color = row.strong ? undefined : GRAY;
        const font = row.strong ? bold : undefined;
        cursor.text(row.label, {
            x: innerLeft + (row.sub ? 12 : 0),
            size,
            color,
            useFont: font,
        });
        cursor.textRight(row.value, {
            rightX: innerRight,
            size,
            color,
            useFont: font,
        });
        cursor.newLine(row.sub ? SUB_ROW_HEIGHT : ROW_HEIGHT);
    }

    const bandTop = cursor.y + ROW_HEIGHT - 14;
    cursor.rect({
        x: innerLeft - 8,
        y: bandTop - TOTAL_BAND,
        width: innerWidth + 16,
        height: TOTAL_BAND,
        fill: BRAND_TINT,
    });
    cursor.y = bandTop - TOTAL_BAND / 2 - 4;
    cursor.text(spec.totalLabel, {
        x: innerLeft,
        size: 11,
        useFont: bold,
    });
    cursor.textRight(spec.totalValue, {
        rightX: innerRight,
        size: 14,
        useFont: bold,
        color: BRAND_BLUE,
    });
    cursor.y = bandTop - TOTAL_BAND - 8;

    for (const line of totalCaptionLines) {
        cursor.newLine(CAPTION_LINE);
        cursor.text(line, { x: innerLeft, size: 8.5, color: GRAY });
    }

    cursor.y = bottom - 18;
}
