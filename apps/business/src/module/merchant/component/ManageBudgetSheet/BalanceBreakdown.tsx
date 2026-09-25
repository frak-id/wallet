import type { Stablecoin } from "@frak-labs/app-essentials";
import {
    type BankBalanceBreakdown,
    BILLING_RATES,
    bpsToPercent,
} from "@frak-labs/app-essentials/constants/billing";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { formatTokenBalance } from "@/module/common/utils/currencyOptions";
import * as styles from "./manage-budget-sheet.css";

export function BalanceBreakdown({
    breakdown,
    stablecoin,
    decimals,
    vatApplicable,
}: {
    breakdown: BankBalanceBreakdown;
    stablecoin: Stablecoin;
    decimals: number;
    vatApplicable: boolean;
}) {
    const { t } = useTranslation();
    const format = (amount: bigint) =>
        formatTokenBalance(amount, stablecoin, decimals);

    return (
        <dl className={styles.breakdown}>
            <div className={styles.breakdownRow}>
                <dt>
                    <Text variant="bodySmall" weight="medium" as="span">
                        {t("funding.budget.breakdown.distributable")}
                    </Text>
                </dt>
                <dd className={styles.breakdownValue}>
                    <Text variant="bodySmall" weight="medium" as="span">
                        {format(breakdown.distributable)}
                    </Text>
                </dd>
            </div>
            <div className={styles.breakdownRow}>
                <dt>
                    <Text variant="bodySmall" color="secondary" as="span">
                        {t("funding.budget.breakdown.frakFee", {
                            rate: bpsToPercent(BILLING_RATES.FRAK_FEE_BPS),
                        })}
                    </Text>
                </dt>
                <dd className={styles.breakdownValue}>
                    <Text variant="bodySmall" color="secondary" as="span">
                        {format(breakdown.frakFee)}
                    </Text>
                </dd>
            </div>
            {vatApplicable && (
                <div className={styles.breakdownRow}>
                    <dt>
                        <Text variant="bodySmall" color="secondary" as="span">
                            {t("funding.budget.breakdown.vat", {
                                rate: bpsToPercent(BILLING_RATES.FR_VAT_BPS),
                            })}
                        </Text>
                    </dt>
                    <dd className={styles.breakdownValue}>
                        <Text variant="bodySmall" color="secondary" as="span">
                            {format(breakdown.vat)}
                        </Text>
                    </dd>
                </div>
            )}
        </dl>
    );
}
