import type { BalanceItem } from "@/types/Token";
import { t } from "i18next";

export const validateAmount = (value: string, selectedToken: BalanceItem) => {
    if (Number.parseFloat(value) <= 0) {
        return t("wallet.tokens.amountPositive");
    }
    if (Number.parseFloat(value) > selectedToken.balance) {
        return t("wallet.tokens.amountLessThanBalance");
    }
    return true;
};