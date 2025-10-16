import { t } from "i18next";
import type { BalanceItem } from "@/types/Balance";

export const validateAmount = (value: string, selectedToken: BalanceItem) => {
    if (Number.parseFloat(value) <= 0) {
        return t("wallet.tokens.amountPositive");
    }
    if (Number.parseFloat(value) > selectedToken.amount) {
        return t("wallet.tokens.amountLessThanBalance");
    }
    return true;
};
