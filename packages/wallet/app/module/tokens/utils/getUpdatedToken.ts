import type { BalanceItem } from "@/types/Token";
import { isAddressEqual, zeroAddress } from "viem";

export function getUpdatedToken({
    tokens,
    selectedToken,
}: { tokens: BalanceItem[]; selectedToken: BalanceItem }) {
    return tokens.find(
        ({ token, balance }) =>
            isAddressEqual(token, selectedToken?.token ?? zeroAddress) &&
            balance !== selectedToken?.balance
    );
}
