import type { Address } from "viem";

export namespace moneriumKey {
    const base = "monerium" as const;

    export const all = [base] as const;

    export const profile = [base, "profile"] as const;
    export const addresses = [base, "addresses"] as const;

    const ordersBase = [base, "orders"] as const;
    export const orders = {
        all: ordersBase,
        byAddress: (address?: Address) =>
            [...ordersBase, address ?? "no-address"] as const,
        byId: (orderId: string) => [...ordersBase, "by-id", orderId] as const,
    };
}
