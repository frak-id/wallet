import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import clsx from "clsx";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import { useGetLegacyBankStatus } from "@/module/merchant/hook/useGetLegacyBankStatus";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMigrateLegacyBank } from "@/module/merchant/hook/useMigrateLegacyBank";
import { legacyBankMap } from "@/module/merchant/utils/legacyBanks";
import * as styles from "./legacy-bank-migration.css";

export function LegacyBankMigration({
    merchantId,
    newBankAddress,
}: {
    merchantId: string;
    newBankAddress: Address;
}) {
    const { data: merchant } = useMerchant({ merchantId });
    const productId = merchant?.productId;
    const oldBankAddress = productId ? legacyBankMap[productId] : undefined;

    if (!oldBankAddress) return null;

    return (
        <LegacyBankMigrationContent
            merchantId={merchantId}
            oldBankAddress={oldBankAddress}
            newBankAddress={newBankAddress}
        />
    );
}

function LegacyBankMigrationContent({
    merchantId,
    oldBankAddress,
    newBankAddress,
}: {
    merchantId: string;
    oldBankAddress: Address;
    newBankAddress: Address;
}) {
    const { t } = useTranslation();
    const { data: status, isLoading } = useGetLegacyBankStatus({
        oldBankAddress,
    });
    const { data: tokenMeta } = useTokenMetadata(status?.token);
    const { mutate: migrate, isPending } = useMigrateLegacyBank({
        merchantId,
    });

    if (isLoading) return <Spinner />;
    if (!status || status.withdrawable === 0n) return null;

    const decimals = tokenMeta?.decimals ?? 6;
    const symbol = tokenMeta?.symbol ?? "???";
    const formattedBalance = formatUnits(status.balance, decimals);
    const formattedPending = formatUnits(status.totalPending, decimals);
    const formattedWithdrawable = formatUnits(status.withdrawable, decimals);

    const handleMigrate = () => {
        migrate({
            oldBankAddress,
            newBankAddress,
            token: status.token,
            withdrawable: status.withdrawable,
            isDistributionEnabled: status.isDistributionEnabled,
        });
    };

    return (
        <div className={styles.legacyPanel}>
            <div className={styles.legacyPanelHeader}>
                <ArrowRightLeft width={16} height={16} />
                <span>{t("funding.legacy.title")}</span>
            </div>

            <p className={styles.legacyPanelDescription}>
                {t("funding.legacy.description")}
            </p>

            <div className={styles.legacyPanelStats}>
                <div className={styles.legacyPanelStatRow}>
                    <span className={styles.legacyPanelStatLabel}>
                        {t("funding.legacy.totalBalance")}
                    </span>
                    <span className={styles.legacyPanelStatValue}>
                        {formattedBalance} {symbol}
                    </span>
                </div>
                {status.totalPending > 0n && (
                    <div className={styles.legacyPanelStatRow}>
                        <span className={styles.legacyPanelStatLabel}>
                            {t("funding.legacy.pending")}
                        </span>
                        <span
                            className={clsx(
                                styles.legacyPanelStatValue,
                                styles.legacyPanelStatValuePending
                            )}
                        >
                            {formattedPending} {symbol}
                        </span>
                    </div>
                )}
                <div className={styles.legacyPanelStatRow}>
                    <span className={styles.legacyPanelStatLabel}>
                        {t("funding.legacy.withdrawable")}
                    </span>
                    <span
                        className={clsx(
                            styles.legacyPanelStatValue,
                            styles.legacyPanelStatValueWithdrawable
                        )}
                    >
                        {formattedWithdrawable} {symbol}
                    </span>
                </div>
            </div>

            <Box display="flex" alignItems="center" gap="xs" marginTop="xxs">
                <Button
                    variant="primary"
                    size="small"
                    onClick={handleMigrate}
                    loading={isPending}
                    disabled={isPending}
                    icon={<ArrowRightLeft width={14} height={14} />}
                >
                    {t("funding.legacy.migrate")}
                </Button>
            </Box>
        </div>
    );
}
