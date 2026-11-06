export namespace cowSwapKey {
    const base = "cow-swap" as const;

    export const quote = (
        sellToken: string,
        buyToken: string,
        amount: string
    ) => [base, "quote", sellToken, buyToken, amount] as const;
    export const swap = [base, "swap"] as const;
}
