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

export const validateAmount = (value: string, selectedToken: BalanceItem) => {
    if (Number.parseFloat(value) <= 0) {
        return "Amount must be positive";
    }
    if (Number.parseFloat(value) > selectedToken.balance) {
        return "Amount must be less than balance";
    }
    return true;
};
