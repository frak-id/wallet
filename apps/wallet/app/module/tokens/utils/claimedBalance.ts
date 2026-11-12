import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, formatUnits, isAddressEqual, toHex } from "viem";

export const STABLECOIN_SYMBOL = {
    usdc: "USDC",
    eure: "EURe",
} satisfies Record<Stablecoin, string>;

type UserBalance = {
    total: Pick<BalanceItem, "amount" | "eurAmount">;
    balances: BalanceItem[];
};

type Claim = { token: Address; amount: bigint; decimals: number };

/** Stablecoins are counted 1:1 in euros, as `useGetPendingRewards` does. */
export function addClaims<T extends UserBalance>(
    balance: T,
    claims: Claim[]
): T {
    let { total, balances } = balance;
    for (const claim of claims) {
        const units = Number(formatUnits(claim.amount, claim.decimals));
        total = {
            ...total,
            amount: total.amount + units,
            eurAmount: total.eurAmount + units,
        };
        const held = balances.find((b) => isAddressEqual(b.token, claim.token));
        if (!held) {
            balances = [...balances, newItem(claim, units)];
            continue;
        }
        const raised: BalanceItem = {
            ...held,
            rawBalance: toHex(BigInt(held.rawBalance) + claim.amount),
            amount: held.amount + units,
            eurAmount: held.eurAmount + units,
        };
        balances = balances.map((b) => (b === held ? raised : b));
    }
    return { ...balance, total, balances };
}

export function includesClaims(
    fresh: UserBalance,
    before: UserBalance | null | undefined,
    claims: Claim[]
) {
    return claims.every(
        ({ token, amount }) =>
            rawBalanceOf(fresh, token) >= rawBalanceOf(before, token) + amount
    );
}

function newItem(claim: Claim, units: number): BalanceItem {
    const id = (Object.keys(currentStablecoins) as Stablecoin[]).find((key) =>
        isAddressEqual(currentStablecoins[key], claim.token)
    );
    const symbol = id ? STABLECOIN_SYMBOL[id] : "";
    return {
        token: claim.token,
        name: symbol,
        symbol,
        decimals: claim.decimals,
        rawBalance: toHex(claim.amount),
        amount: units,
        eurAmount: units,
        usdAmount: 0,
        gbpAmount: 0,
    };
}

function rawBalanceOf(
    balance: UserBalance | null | undefined,
    token: Address
): bigint {
    const item = balance?.balances.find((b) => isAddressEqual(b.token, token));
    return item ? BigInt(item.rawBalance) : 0n;
}
