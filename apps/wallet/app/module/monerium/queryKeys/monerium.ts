export namespace moneriumKey {
    const base = "monerium" as const;

    export const all = [base] as const;

    export const profile = [base, "profile"] as const;

    export const iban = (profileId: string | null) =>
        [base, "iban", profileId] as const;

    export const addresses = [base, "addresses"] as const;
}
