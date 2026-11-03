export namespace moneriumKey {
    const base = "monerium" as const;

    export const all = [base] as const;

    export const status = [base, "status"] as const;
    export const orders = [base, "orders"] as const;
}
