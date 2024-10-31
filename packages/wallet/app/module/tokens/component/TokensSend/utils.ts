import type { BalanceItem } from "@/types/Token";
import { t } from "i18next";
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
        return t("wallet.tokens.amountPositive");
    }
    if (Number.parseFloat(value) > selectedToken.balance) {
        return t("wallet.tokens.amountLessThanBalance");
    }
    return true;
};
