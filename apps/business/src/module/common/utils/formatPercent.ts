// `fractionDigits` defaults to 0 for compact table cells (e.g. "57%");
// detailed views like the performance sheet pass 2 for "57.32%".
export function formatPercent(value: number, fractionDigits = 0): string {
    return `${(value * 100).toFixed(fractionDigits)}%`;
}
