export namespace installCodeKey {
    const base = "install-code" as const;

    export const generate = (
        merchantId?: string,
        anonymousId?: string,
        checkoutToken?: string
    ) =>
        [
            base,
            "generate",
            merchantId ?? "none",
            anonymousId ?? "none",
            checkoutToken ?? "none",
        ] as const;

    export const resolve = [base, "resolve"] as const;
}
