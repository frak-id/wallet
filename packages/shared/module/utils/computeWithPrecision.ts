/**
 * Compute with precision, avoiding floating point errors
 * eg: 0.1 + 0.2 = .30000000000000004
 * @param value1
 * @param value2
 * @param operator
 * @param precision
 */
export function computeWithPrecision(
    value1: number,
    value2: number,
    operator: "+" | "-" | "*" = "+",
    precision = 1000
) {
    const operation = {
        "+": (a: number, b: number) => a + b,
        "-": (a: number, b: number) => a - b,
        "*": (a: number, b: number) => (a * b) / precision,
    }[operator];

    return operation(value1 * precision, value2 * precision) / precision;
}
