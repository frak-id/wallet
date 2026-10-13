import type { PDFFont } from "pdf-lib";
import { GRAY, MARGIN, PAGE_WIDTH, type PageCursor } from "./primitives";

export type BreakdownRow = {
    label: string;
    value: string;
    /** Indented, smaller "dont …" detail line. */
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

const ROW_HEIGHT = 18;
const SUB_ROW_HEIGHT = 15;

/**
 * Plain statement table shared by the deposit note, the withdraw note and the
 * monthly bill's account status: the amount first, the deductions below, a
 * rule, then the final amount in bold — same order as the dashboards' budget
 * display.
 */
export function drawBreakdownCard(
    cursor: PageCursor,
    bold: PDFFont,
    spec: BreakdownCardSpec
): void {
    const right = PAGE_WIDTH - MARGIN;
    const captionLines = spec.totalCaption
        ? cursor.wrap(spec.totalCaption, {
              size: 8.5,
              maxWidth: right - MARGIN,
          })
        : [];
    const rowsHeight = spec.rows.reduce(
        (sum, row) => sum + (row.sub ? SUB_ROW_HEIGHT : ROW_HEIGHT),
        0
    );
    cursor.ensureSpace(
        ROW_HEIGHT * 2 + 14 + rowsHeight + captionLines.length * 12 + 20
    );

    cursor.rule(cursor.y + 14, MARGIN, right);
    cursor.text(spec.headlineLabel, { size: 11, useFont: bold });
    cursor.textRight(spec.headlineValue, {
        size: 11,
        useFont: bold,
    });
    cursor.newLine(spec.headlineCaption ? 13 : ROW_HEIGHT);
    if (spec.headlineCaption) {
        cursor.text(spec.headlineCaption, { size: 8.5, color: GRAY });
        cursor.newLine(ROW_HEIGHT);
    }

    for (const row of spec.rows) {
        const size = row.sub ? 9 : 10;
        const color = row.strong ? undefined : GRAY;
        const useFont = row.strong ? bold : undefined;
        cursor.text(row.label, {
            x: MARGIN + (row.sub ? 12 : 0),
            size,
            color,
            useFont,
        });
        cursor.textRight(row.value, { size, color, useFont });
        cursor.newLine(row.sub ? SUB_ROW_HEIGHT : ROW_HEIGHT);
    }

    cursor.newLine(8);
    cursor.rule(cursor.y + 12, MARGIN, right);
    cursor.newLine(8);
    cursor.text(spec.totalLabel, { size: 11, useFont: bold });
    cursor.textRight(spec.totalValue, { size: 11, useFont: bold });
    cursor.newLine(16);
    for (const line of captionLines) {
        cursor.text(line, { size: 8.5, color: GRAY });
        cursor.newLine(12);
    }
    cursor.newLine(10);
}
