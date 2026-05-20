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
