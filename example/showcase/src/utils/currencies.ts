export type Currency = "eur" | "usd" | "gbp";

export const currencies = [
    { value: "eur" as const, label: "€ Euro" },
    { value: "usd" as const, label: "$ US Dollar" },
    { value: "gbp" as const, label: "£ British Pound" },
];

export function getCurrencyLabel(currency: Currency): string | undefined {
    return currencies.find((curr) => curr.value === currency)?.label;
}
