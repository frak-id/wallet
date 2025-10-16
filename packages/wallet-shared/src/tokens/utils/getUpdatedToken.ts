import { isAddressEqual, zeroAddress } from "viem";
import type { BalanceItem } from "@/types/Balance";

export function getUpdatedToken({
    tokens,
    selectedToken,
}: {
    tokens: BalanceItem[];
    selectedToken: BalanceItem;
}) {
    return tokens.find(
        ({ token, amount }) =>
            isAddressEqual(token, selectedToken?.token ?? zeroAddress) &&
            amount !== selectedToken?.amount
    );
}
