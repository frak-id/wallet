/** Round to `dp` decimal places (default 2). */
export function roundTo(n: number, dp = 2): number {
    const factor = 10 ** dp;
    return Math.round(n * factor) / factor;
}
