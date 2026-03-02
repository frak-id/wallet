import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { ArrowRightLeft } from "lucide-react";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import { useGetLegacyBankStatus } from "@/module/merchant/hook/useGetLegacyBankStatus";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMigrateLegacyBank } from "@/module/merchant/hook/useMigrateLegacyBank";
import { legacyBankMap } from "@/module/merchant/utils/legacyBanks";
import styles from "./LegacyBankMigration.module.css";

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
            <div className={styles.legacyPanel__header}>
                <ArrowRightLeft width={16} height={16} />
                <span>Legacy Bank Migration</span>
            </div>

            <p className={styles.legacyPanel__description}>
                Your old campaign bank still holds funds. Migrate them to your
                new bank to continue distributing rewards.
            </p>

            <div className={styles.legacyPanel__stats}>
                <div className={styles.legacyPanel__statRow}>
                    <span className={styles.legacyPanel__statLabel}>
                        Total balance
                    </span>
                    <span className={styles.legacyPanel__statValue}>
                        {formattedBalance} {symbol}
                    </span>
                </div>
                {status.totalPending > 0n && (
                    <div className={styles.legacyPanel__statRow}>
                        <span className={styles.legacyPanel__statLabel}>
                            Pending rewards (locked)
                        </span>
                        <span
                            className={`${styles.legacyPanel__statValue} ${styles["legacyPanel__statValue--pending"]}`}
                        >
                            {formattedPending} {symbol}
                        </span>
                    </div>
                )}
                <div className={styles.legacyPanel__statRow}>
                    <span className={styles.legacyPanel__statLabel}>
                        Available to migrate
                    </span>
                    <span
                        className={`${styles.legacyPanel__statValue} ${styles["legacyPanel__statValue--withdrawable"]}`}
                    >
                        {formattedWithdrawable} {symbol}
                    </span>
                </div>
            </div>

            <div className={styles.legacyPanel__actions}>
                <Button
                    variant="submit"
                    size="small"
                    onClick={handleMigrate}
                    isLoading={isPending}
                    disabled={isPending}
                >
                    <ArrowRightLeft width={14} height={14} />
                    Migrate funds to new bank
                </Button>
            </div>
        </div>
    );
}
