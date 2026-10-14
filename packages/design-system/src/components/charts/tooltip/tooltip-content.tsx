import { getIntFmt } from "../chart-formatters";

export interface TooltipRow {
    color: string;
    label: string;
    value: number;
}

interface TooltipContentProps {
    title?: string;
    rows: TooltipRow[];
    /** BCP-47 locale for numeric value formatting. */
    locale: string;
}

export function TooltipContent({ title, rows, locale }: TooltipContentProps) {
    const intFmt = getIntFmt(locale);
    return (
        <div className="overflow-hidden">
            <div className="px-3 py-2.5">
                {title && (
                    <div className="mb-2 font-medium text-chart-tooltip-foreground text-xs">
                        {title}
                    </div>
                )}
                <div className="space-y-1.5">
                    {rows.map((row) => (
                        <div
                            className="flex items-center justify-between gap-4"
                            key={`${row.label}-${row.color}`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: row.color }}
                                />
                                <span className="text-chart-tooltip-muted text-sm">
                                    {row.label}
                                </span>
                            </div>
                            <span className="font-medium text-chart-tooltip-foreground text-sm tabular-nums">
                                {intFmt.format(row.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

TooltipContent.displayName = "TooltipContent";
